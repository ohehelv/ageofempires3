// Склеивает src/*.js (по алфавиту: 01…16) в одну IIFE и вставляет после shell.html.
// Результат — один самодостаточный HTML: dist/index.html (и копия dist/kolonii.html).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.js')).sort();
let js = files.map((f) => `// ==== ${f}\n` + fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
js = "(function(){\n'use strict';\n" + js + '\n})();\n';
if (js.includes('</script')) throw new Error('script tag inside JS');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'game.js'), js);
const shell = fs.readFileSync(path.join(root, 'shell.html'), 'utf8');
const three = '<script src="https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js"></script>';
const html = shell + '\n' + three + '\n<script>\n' + js + '</script>\n';
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
fs.writeFileSync(path.join(root, 'dist', 'kolonii.html'), html);
console.log('built', (html.length / 1024).toFixed(1) + ' KB', files.length, 'modules → dist/index.html');
