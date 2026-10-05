"""Build the selected CC0 meshes; downloaded source packs stay outside public/.
Usage: python scripts/prepare-cc0-assets.py <Kenney OBJ directory> <Ranger.gltf>
Sources and licenses: docs/asset-sources.md. Requires Python standard library only.
"""
import base64
import json
from pathlib import Path
import struct
import sys

root, ranger = Path(sys.argv[1]), Path(sys.argv[2])
out = {}
for name in ['tree_oak', 'tree_pineRoundD', 'tree_pineTallA_detailed']:
    vertices, normals, positions, rendered_normals, colors, indices = [], [], [], [], [], []
    material = ''
    for line in (root / (name + '.obj')).read_text().splitlines():
        fields = line.split()
        if not fields:
            continue
        if fields[0] == 'v':
            vertices.append(list(map(float, fields[1:4])))
        elif fields[0] == 'vn':
            normals.append(list(map(float, fields[1:4])))
        elif fields[0] == 'usemtl':
            material = fields[1]
        elif fields[0] == 'f':
            for i in range(1, len(fields) - 2):
                for token in [fields[1], fields[i + 1], fields[i + 2]]:
                    ix = token.split('/')
                    p = vertices[int(ix[0]) - 1]
                    positions += p
                    rendered_normals += normals[int(ix[2]) - 1]
                    leaf = 'leaf' in material.lower()
                    col = (0.54, 0.79, 0.49) if leaf else (0.64, 0.40, 0.23)
                    if leaf:
                        factor = .87 + min(1, p[1] / 1.7) * .29
                        col = tuple(c * factor for c in col)
                    colors += list(col) + [1]
                    indices.append(len(indices))
    factor = 3.35 / max(positions[1::3])
    out[name] = dict(positions=[round(v * factor, 5) for v in positions],
                     normals=rendered_normals, colors=[round(v, 4) for v in colors], indices=indices)
Path('src/assets').mkdir(exist_ok=True)
Path('src/assets/nature-meshes.json').write_text(json.dumps(out, separators=(',', ':')))

model = json.loads(ranger.read_text())
source_bytes = base64.b64decode(model['buffers'][0].pop('uri').split(',')[1])
model['animations'] = [a for a in model['animations'] if a['name'] in
                       ['Idle', 'Run', 'Punch', 'PickUp', 'RecieveHit']]
# Original model is painted/unlit; the runtime adapter configures that treatment.
model.pop('extensionsUsed', None)
for material in model['materials']:
    material.pop('extensions', None)
# Retain bone indices for animation, but do not publish the unused bow geometry.
for node in model['nodes']:
    if node.get('name') == 'Ranger_Bow':
        node.pop('mesh', None)
used_meshes = sorted({n['mesh'] for n in model['nodes'] if 'mesh' in n})
mesh_map = {old: new for new, old in enumerate(used_meshes)}
model['meshes'] = [model['meshes'][i] for i in used_meshes]
for node in model['nodes']:
    if 'mesh' in node:
        node['mesh'] = mesh_map[node['mesh']]

assert all(p['material'] == 0 for mesh in model['meshes'] for p in mesh['primitives'])
model['materials'] = model['materials'][:1]
model['textures'] = model['textures'][:1]
used_accessors = set()
for mesh in model['meshes']:
    for primitive in mesh['primitives']:
        used_accessors.update(primitive['attributes'].values())
        used_accessors.add(primitive['indices'])
for skin in model['skins']:
    used_accessors.add(skin['inverseBindMatrices'])
for animation in model['animations']:
    for sampler in animation['samplers']:
        used_accessors.update([sampler['input'], sampler['output']])
accessor_map = {old: new for new, old in enumerate(sorted(used_accessors))}
model['accessors'] = [model['accessors'][i] for i in sorted(used_accessors)]
for mesh in model['meshes']:
    for primitive in mesh['primitives']:
        primitive['attributes'] = {key: accessor_map[value] for key, value in primitive['attributes'].items()}
        primitive['indices'] = accessor_map[primitive['indices']]
for skin in model['skins']:
    skin['inverseBindMatrices'] = accessor_map[skin['inverseBindMatrices']]
for animation in model['animations']:
    for sampler in animation['samplers']:
        sampler['input'], sampler['output'] = accessor_map[sampler['input']], accessor_map[sampler['output']]
used_views = sorted({a['bufferView'] for a in model['accessors']} |
                    {image['bufferView'] for image in model['images']})
view_map = {old: new for new, old in enumerate(used_views)}
packed = bytearray()
views = []
for old in used_views:
    view = dict(model['bufferViews'][old])
    start = view.get('byteOffset', 0)
    payload = source_bytes[start:start + view['byteLength']]
    packed.extend(b'\0' * ((-len(packed)) % 4))
    view['byteOffset'] = len(packed)
    packed.extend(payload)
    # Copied accessor payloads, textures and animation samples remain byte-identical.
    assert bytes(packed[view['byteOffset']:view['byteOffset'] + view['byteLength']]) == payload
    views.append(view)
model['bufferViews'] = views
for entry in model['accessors'] + model['images']:
    entry['bufferView'] = view_map[entry['bufferView']]
model['buffers'][0]['byteLength'] = len(packed)
metadata = json.dumps(model, separators=(',', ':')).encode()
metadata += b' ' * ((-len(metadata)) % 4)
packed.extend(b'\0' * ((-len(packed)) % 4))
glb = (struct.pack('<III', 0x46546c67, 2, 28 + len(metadata) + len(packed)) +
       struct.pack('<II', len(metadata), 0x4e4f534a) + metadata +
       struct.pack('<II', len(packed), 0x004e4942) + packed)
Path('public/models').mkdir(parents=True, exist_ok=True)
Path('public/models/keeper.glb').write_bytes(glb)
print(f'Prepared {len(out)} trees and keeper.glb ({len(glb)} bytes), excluding unused bow and animation data.')
