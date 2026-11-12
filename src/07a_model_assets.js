// Prepare the imported outpost before building geometry and icons are cached.
let outpostModel;

async function loadOutpostModel() {
  try {
    const { GLTFLoader, MeshoptDecoder } = loadGltfSupport();
    const bytes = Uint8Array.from(atob(OUTPOST_GLB), (c) => c.charCodeAt(0));
    const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer, '');
    scene.updateMatrixWorld(true);
    const mesh = scene.getObjectByProperty('isMesh', true);
    const geometry = mesh.geometry;
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const footprint = BUILDINGS.outpost.size - 0.2;
    const scale = Math.min(footprint / Math.max(size.x, size.z), BUILDINGS.outpost.height / size.y);
    geometry.translate(-center.x, -bounds.min.y, -center.z);
    geometry.scale(scale, scale, scale);
    const flag = new PartBuilder();
    flagPole(flag, 0, size.y * scale - 0.25, 0, 1.6, 0.8);
    outpostModel = {
      main: geometry,
      flag,
      material: patchMaterial(mesh.material),
      iconMaterial: patchMaterial(mesh.material.clone(), { fow: false }),
    };
  } catch (error) {
    console.warn('Не удалось загрузить модель заставы', error);
  }
}

function createBuildingMesh(geo, kind, overrideMaterial) {
  const material = kind === 'static' ? geo.material : geo.iconMaterial;
  const mesh = new THREE.Mesh(geo.main, overrideMaterial || material || modelMaterial(kind));
  if (geo.flag) {
    const flag = new THREE.Mesh(geo.flag, overrideMaterial || modelMaterial(kind));
    flag.castShadow = true;
    flag.receiveShadow = true;
    mesh.add(flag);
  }
  return mesh;
}
