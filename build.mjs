// Склеивает src/*.js (по алфавиту: 01…16) в одну IIFE и вставляет после shell.html.
// Результат — один самодостаточный HTML: dist/index.html (и копия dist/kolonii.html).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';
import * as three from 'three';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.js')).sort();
const threeExports = Object.keys(three);
const gltfLicense = fs.readFileSync(new URL('../LICENSE', import.meta.resolve('three')), 'utf8')
  .replace(/^(Copyright[^\r\n]*)/m, '$1\nCopyright (C) 2016-2022 Arseny Kapoulkine (meshoptimizer)');
const gltf = await build({
  absWorkingDir: root,
  stdin: { contents: `
    export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
    export { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
  `, resolveDir: root },
  bundle: true,
  write: false,
  minify: true,
  format: 'iife',
  globalName: 'GLTFSupport',
  banner: { js: `/*!\n${gltfLicense.trim()}\n*/` },
  plugins: [{
    name: 'three-global',
    setup(bundler) {
      bundler.onResolve({ filter: /^three$/ }, () => ({ path: 'three', namespace: 'three-global' }));
      bundler.onLoad({ filter: /.*/, namespace: 'three-global' }, () => ({
        contents: `const { ${threeExports.join(', ')} } = globalThis.THREE; export { ${threeExports.join(', ')} };`,
      }));
    },
  }],
});
const outpost = fs.readFileSync(path.join(root, 'assets/outpost.glb')).toString('base64');
const models = fs.readFileSync(path.join(root, 'assets/models.json'), 'utf8');
let js = files.map((f) => `// ==== ${f}\n` + fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
js = `(function(){\n'use strict';\nfunction loadGltfSupport() {\n${gltf.outputFiles[0].text}\nreturn GLTFSupport;\n}\nconst OUTPOST_GLB = '${outpost}';\nconst ART_MODELS = ${models};\n${js}\n})();\n`;
if (js.includes('</script')) throw new Error('script tag inside JS');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'game.js'), js);
const shell = fs.readFileSync(path.join(root, 'shell.html'), 'utf8');
const threeScript = '<script src="https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js"></script>';
const html = shell + '\n' + threeScript + '\n<script>\n' + js + '</script>\n';
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
fs.writeFileSync(path.join(root, 'dist', 'kolonii.html'), html);
console.log('built', (html.length / 1024).toFixed(1) + ' KB', files.length, 'modules → dist/index.html');
