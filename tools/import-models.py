"""Build the browser's compact mesh pack. Requires numpy and Pillow."""

import base64
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import struct
import subprocess
from shutil import which
import tempfile
from threading import Lock
from urllib.parse import quote, urljoin

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHOWCASE = ('https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/'
            '0128ca510d653bb04d6d1e4885bd8890b5050b4f/public/glb/')
FREE_MODELS = ('https://raw.githubusercontent.com/agentkaerf/FreeModels/'
               'db3df04d1e4714298a09510b26fb6de6645138a2/')
CACHE = Path(tempfile.gettempdir()) / 'aoe3-art-sources' / 'gltf'
CACHE_LOCK = Lock()


def entries(base, directory, extension, names):
    return {key: base + quote(f'{directory}/{name}.{extension}') for key, name in names.items()}


SOURCES = {
    **entries(SHOWCASE, 'medieval_village_pack', 'glb', {
        'cottage': 'House_1', 'manor': 'Inn', 'houseLong': 'House_2',
        'hall': 'House_4', 'stable': 'Stable', 'smithy': 'Blacksmith', 'mill': 'Mill',
        'bellTower': 'Bell_Tower', 'stall': 'MarketStand_1', 'stallWide': 'MarketStand_2',
        'sawmill': 'Sawmill', 'fence': 'Fence', 'barrel': 'Barrel', 'crate': 'Crate',
        'sacks': 'Bags', 'cart': 'Cart', 'hay': 'Hay', 'well': 'Well',
    }),
    **entries(SHOWCASE, 'modular_medieval_buildings_pack', 'glb', {
        'keep': 'LargeSquareTowerBricks', 'bastion': 'SmallSquareTowerBricks',
        'wall': 'WallBricks', 'gate': 'WallEntranceBricks', 'target': 'Target',
        'gothicWindow': 'WindowGothic',
    }),
    **entries(SHOWCASE, 'nature_pack', 'glb', {
        'pine': 'PineTree_2', 'spruce': 'PineTree_4', 'snowpine': 'PineTree_Snow_3',
        'oak': 'CommonTree_3', 'cottonwood': 'Willow_1', 'birch': 'BirchTree_2',
        'mesquite': 'CommonTree_Autumn_1', 'saguaro': 'Cactus_3',
        'berries': 'BushBerries_2', 'grass': 'Grass_2', 'flowers': 'Flowers',
        'rock': 'Rock_3', 'rockMoss': 'Rock_Moss_4', 'log': 'WoodLog', 'wheat': 'Wheat', 'corn': 'Corn_1',
    }),
    **entries(SHOWCASE, 'animals_pack', 'glb', {
        'doe': 'Deer', 'stag': 'Stag', 'wolf': 'Wolf', 'horse': 'Horse',
    }),
    **entries(SHOWCASE, 'medieval_weapons_pack', 'glb', {
        'bow': 'Bow_Wooden', 'spear': 'Spear', 'roundShield': 'Shield_Round', 'claymore': 'Claymore',
    }),
    **entries(FREE_MODELS, 'Pirate Kit - Nov 2023/glTF', 'gltf', {
        'captain': 'Characters_Captain_Barbarossa', 'henry': 'Characters_Henry', 'anne': 'Characters_Anne',
        'cannon': 'Prop_Cannon', 'treasure': 'Prop_Chest_Gold', 'bomb': 'Prop_Bomb',
        'musket': 'Weapon_Rifle', 'pistol': 'Weapon_Pistol', 'cutlass': 'Weapon_Cutlass',
        'axe': 'Weapon_Axe', 'coinBag': 'Prop_GoldBag',
    }),
    **entries(FREE_MODELS, 'Ultimate Modular Men- Feb 2022/Individual Characters/glTF', 'gltf', {
        'farmer': 'Farmer', 'adventurer': 'Adventurer',
    }),
    'bear': 'https://pixor.art/library/files/bear/pixor-library-bear.glb',
    'bison': 'https://static.poly.pizza/647f7125-c33c-4e8a-af49-8632bf612676.glb',
}

TRIANGLE_LIMITS = dict.fromkeys(('pine', 'spruce', 'snowpine', 'oak', 'cottonwood', 'birch', 'mesquite'), 650)
TRIANGLE_LIMITS.update(dict.fromkeys(('captain', 'henry', 'anne', 'adventurer', 'farmer'), 2200))
TRIANGLE_LIMITS.update(dict.fromkeys(('wolf', 'horse', 'doe', 'stag', 'bear', 'bison'), 1300))
TRIANGLE_LIMITS.update(dict.fromkeys(('barrel', 'crate', 'sacks', 'hay', 'coinBag', 'corn', 'wheat'), 420))
TRIANGLE_LIMITS.update(dict.fromkeys(('cannon', 'cart', 'treasure', 'well'), 1200))
TRIANGLE_LIMITS.update(dict.fromkeys(('bow', 'spear', 'roundShield', 'claymore', 'bomb', 'musket', 'pistol', 'cutlass', 'axe'), 520))


def download(url):
    cached = CACHE / sha256(url.encode()).hexdigest()
    with CACHE_LOCK:
        if cached.exists():
            return cached.read_bytes()
    data = subprocess.check_output([which('curl.exe') or 'curl', '-fLsS', '--retry', '2', '--max-time', '30', url])
    with CACHE_LOCK:
        if not cached.exists():
            cached.write_bytes(data)
    return data


def resource(url, uri):
    if uri.startswith('data:'):
        return base64.b64decode(uri.split(',', 1)[1])
    return download(urljoin(url, quote(uri, safe='/%')))


def node_matrix(node):
    if 'matrix' in node:
        return np.array(node['matrix']).reshape(4, 4).T
    x, y, z, w = node.get('rotation', (0, 0, 0, 1))
    rotation = np.array([
        [1 - 2*y*y - 2*z*z, 2*x*y - 2*z*w, 2*x*z + 2*y*w],
        [2*x*y + 2*z*w, 1 - 2*x*x - 2*z*z, 2*y*z - 2*x*w],
        [2*x*z - 2*y*w, 2*y*z + 2*x*w, 1 - 2*x*x - 2*y*y],
    ])
    matrix = np.eye(4)
    matrix[:3, :3] = rotation * node.get('scale', (1, 1, 1))
    matrix[:3, 3] = node.get('translation', (0, 0, 0))
    return matrix


class Gltf:
    def __init__(self, url):
        self.url = url
        raw = download(url)
        binary = None
        if raw.startswith(b'glTF'):
            length = struct.unpack_from('<I', raw, 12)[0]
            self.data = json.loads(raw[20:20 + length])
            binary = raw[28 + length:]
        else:
            self.data = json.loads(raw)
        self.buffers = [resource(url, b['uri']) if 'uri' in b else binary for b in self.data['buffers']]
        self.nodes = self.data['nodes']
        self.world = {}
        self.images = {}
        roots = self.data['scenes'][self.data.get('scene', 0)]['nodes']
        for root in roots:
            self.visit(root, np.eye(4))

    def visit(self, index, parent):
        node = self.nodes[index]
        world = self.world[index] = parent @ node_matrix(node)
        for child in node.get('children', []):
            self.visit(child, world)

    def view(self, index):
        view = self.data['bufferViews'][index]
        return self.buffers[view['buffer']], view.get('byteOffset', 0), view

    def accessor(self, index):
        a = self.data['accessors'][index]
        dtype = np.dtype({5120: 'i1', 5121: 'u1', 5122: '<i2', 5123: '<u2', 5125: '<u4', 5126: '<f4'}[a['componentType']])
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
        buf, start, view = self.view(a['bufferView'])
        values = np.ndarray((a['count'], width), dtype, buf, start + a.get('byteOffset', 0),
                            (view.get('byteStride', dtype.itemsize * width), dtype.itemsize))
        if a.get('normalized'):
            return np.maximum(values.astype(float) / np.iinfo(dtype).max, -1)
        return values

    def image(self, index):
        if index not in self.images:
            image = self.data['images'][index]
            if 'uri' in image:
                raw = resource(self.url, image['uri'])
            else:
                buf, start, view = self.view(image['bufferView'])
                raw = buf[start:start + view['byteLength']]
            with Image.open(BytesIO(raw)) as source:
                self.images[index] = np.array(source.convert('RGB'))
        return self.images[index]

    def colors(self, prim, attrs, count):
        material = self.data.get('materials', [{}])[prim.get('material', 0)]
        pbr = material.get('pbrMetallicRoughness', {})
        color = np.tile(np.array(pbr.get('baseColorFactor', [1, 1, 1, 1])[:3], dtype=float), (count, 1))
        if 'COLOR_0' in attrs:
            color *= self.accessor(attrs['COLOR_0'])[:, :3]
        if 'baseColorTexture' in pbr:
            tex = pbr['baseColorTexture']
            uv = self.accessor(attrs[f"TEXCOORD_{tex.get('texCoord', 0)}"])
            pixels = self.image(self.data['textures'][tex['index']]['source'])
            height, width, _ = pixels.shape
            x, y = np.minimum((uv % 1) * [width, height], [width - 1, height - 1]).astype(int).T
            srgb = pixels[y, x] / 255
            color *= np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
        return np.rint(255 * np.where(color <= 0.0031308, 12.92 * color,
                                     1.055 * color ** (1 / 2.4) - 0.055)).clip(0, 255).astype('u1')

    def parts(self):
        joint_names, joint_points = [], []
        joint_lookup = {}
        for index, world in self.world.items():
            node = self.nodes[index]
            if 'mesh' not in node:
                continue
            mesh = self.data['meshes'][node['mesh']]
            if 'skin' in node:
                skin = self.data['skins'][node['skin']]
                joints = skin['joints']
                for j in joints:
                    if j in joint_lookup:
                        continue
                    joint_lookup[j] = len(joint_names)
                    joint_names.append(self.nodes[j].get('name', ''))
                    joint_points.append(self.world[j][:3, 3])
                joint_ids = np.array([joint_lookup[j] for j in joints])
                inverse_bind = self.accessor(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
                skin_matrices = np.array([self.world[j] for j in joints]) @ inverse_bind
            for prim in mesh['primitives']:
                assert prim.get('mode', 4) == 4, self.url
                attrs = prim['attributes']
                local = self.accessor(attrs['POSITION'])
                p = local @ world[:3, :3].T + world[:3, 3]
                color = self.colors(prim, attrs, len(p))
                joint = np.full(len(p), 255, dtype='u1')
                if 'JOINTS_0' in attrs:
                    bones = self.accessor(attrs['JOINTS_0'])
                    weights = self.accessor(attrs['WEIGHTS_0'])
                    joint = joint_ids[bones[np.arange(len(p)), weights.argmax(axis=1)]]
                    blended = np.einsum('vk,vkij->vij', weights, skin_matrices[bones])
                    p = np.einsum('vij,vj->vi', blended[:, :3, :3], local) + blended[:, :3, 3]
                faces = self.accessor(prim['indices']).ravel() if 'indices' in prim else np.arange(len(p))
                if np.linalg.det(world[:3, :3]) < 0:
                    faces = faces.reshape(-1, 3)[:, [0, 2, 1]].ravel()
                if 'NORMAL' in attrs:
                    local_normal = self.accessor(attrs['NORMAL'])
                    if 'JOINTS_0' in attrs:
                        n = np.einsum('vij,vj->vi', blended[:, :3, :3], local_normal)
                    else:
                        n = local_normal @ np.linalg.inv(world[:3, :3])
                else:
                    triangles = faces.reshape(-1, 3)
                    v = p[triangles]
                    flat = np.cross(v[:, 1] - v[:, 0], v[:, 2] - v[:, 0])
                    n = np.zeros_like(p)
                    np.add.at(n, faces, np.repeat(flat, 3, axis=0))
                n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-7)
                yield node.get('name', mesh.get('name', '')), p, n, color, joint, faces, joint_names, joint_points


def simplify(p, n, color, joint, indices, scale, budget):
    if len(indices) <= budget * 3:
        return p, n, color, joint, indices
    # Keep palette and limb boundaries while collapsing the smallest details.
    for resolution in (96, 64, 48, 36, 28, 20, 15, 10):
        grid = np.floor(p * (resolution / scale)).astype(int)
        attributes = np.column_stack((grid, color // 32, joint))
        _, representative, groups = np.unique(attributes, axis=0, return_index=True, return_inverse=True)
        faces = groups[indices].reshape(-1, 3)
        a, b, c = faces.T
        faces = faces[(a != b) & (a != c) & (b != c)]
        _, unique = np.unique(np.sort(faces, axis=1), axis=0, return_index=True)
        faces = faces[np.sort(unique)].ravel()
        if len(faces) <= budget * 3:
            break
    if not len(faces):
        return p, n, color, joint, indices
    used, faces = np.unique(faces, return_inverse=True)
    positions = np.zeros((len(representative), 3))
    np.add.at(positions, groups, p)
    positions /= np.bincount(groups)[:, None]
    representative = representative[used]
    return positions[used], n[representative], color[representative], joint[representative], faces


def convert(item):
    key, url = item
    parts = list(Gltf(url).parts())
    if key in ('captain', 'henry', 'anne'):
        parts = [part for part in parts if part[0] == parts[0][0]]
    vertices = np.concatenate([part[1] for part in parts])
    low, high = vertices.min(axis=0), vertices.max(axis=0)
    anchor = (low + high) / 2
    anchor[1] = low[1]
    scale = max(high - low)
    data, groups, offset = [], [], 0
    faces = []
    total = sum(len(part[5]) // 3 for part in parts)
    for name, p, n, color, joint, indices, joint_names, joint_points in parts:
        budget = max(12, len(indices) // 3 * TRIANGLE_LIMITS.get(key, total) // total)
        p, n, color, joint, indices = simplify(p, n, color, joint, indices, scale, budget)
        pos = np.rint((p - anchor) * (16384 / scale)).astype('<i2')
        norm = np.rint(n * 127).astype('i1')
        data.append(np.column_stack((pos.view('u1'), norm.view('u1'), color, joint.astype('u1'))).tobytes())
        groups.append([name, len(indices)])
        faces.append(indices.astype('u4') + offset)
        offset += len(p)
    if offset > 65535 or len(joint_names) >= 255:
        raise ValueError(f'Model is too large: {key}')
    blob = b''.join(data) + np.concatenate(faces).astype('<u2').tobytes()
    joints = [[name, *((np.asarray(point) - anchor) / scale).round(5).tolist()]
              for name, point in zip(joint_names, joint_points)]
    print(f'{key}: {sum(group[1] for group in groups) // 3} triangles')
    return key, [offset, base64.b64encode(blob).decode(), groups, joints]


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=10) as executor:
        models = dict(executor.map(convert, SOURCES.items()))
    with (ROOT / 'assets' / 'models.json').open('w', encoding='utf-8', newline='\n') as file:
        file.write('{\n')
        file.write(',\n'.join(f'{json.dumps(key)}:{json.dumps(value, separators=(",", ":"))}'
                              for key, value in models.items()))
        file.write('\n}\n')


if __name__ == '__main__':
    main()
