"""Pack only the approved KayKit Rogue and five clips. Sources stay in input/."""
import json, struct
from pathlib import Path
src=Path('input/approved/kaykit/Rogue.glb').read_bytes()
n=struct.unpack_from('<I',src,12)[0]; j=json.loads(src[20:20+n]); binary=src[28+n:]
clips={'Idle':'Idle','Running_A':'Run','1H_Melee_Attack_Chop':'Punch','PickUp':'PickUp','Hit_A':'RecieveHit'}
j['animations']=[dict(a,name=clips[a['name']]) for a in j['animations'] if a['name'] in clips]
for node in j['nodes']:
 if node.get('name') in ['Knife','Knife_Offhand','1H_Crossbow','2H_Crossbow','Throwable']: node.pop('mesh',None)
used=sorted({n['mesh'] for n in j['nodes'] if 'mesh' in n}); mp={v:i for i,v in enumerate(used)}
j['meshes']=[j['meshes'][i] for i in used]
for n in j['nodes']:
 if 'mesh' in n: n['mesh']=mp[n['mesh']]
acc=set()
for m in j['meshes']:
 for p in m['primitives']: acc.update(p['attributes'].values());acc.add(p['indices'])
for s in j['skins']: acc.add(s['inverseBindMatrices'])
for a in j['animations']:
 for s in a['samplers']: acc.update([s['input'],s['output']])
mp={v:i for i,v in enumerate(sorted(acc))}; j['accessors']=[j['accessors'][i] for i in sorted(acc)]
for m in j['meshes']:
 for p in m['primitives']: p['attributes']={k:mp[v] for k,v in p['attributes'].items()};p['indices']=mp[p['indices']]
for s in j['skins']: s['inverseBindMatrices']=mp[s['inverseBindMatrices']]
for a in j['animations']:
 for s in a['samplers']: s['input']=mp[s['input']];s['output']=mp[s['output']]
views=sorted({a['bufferView'] for a in j['accessors']}|{i['bufferView'] for i in j['images']});mp={v:i for i,v in enumerate(views)};out=bytearray();new=[]
for i in views:
 v=dict(j['bufferViews'][i]);start=v.get('byteOffset',0);payload=binary[start:start+v['byteLength']];out.extend(b'\0'*((-len(out))%4));v['byteOffset']=len(out);out.extend(payload);new.append(v)
j['bufferViews']=new
for a in j['accessors']+j['images']: a['bufferView']=mp[a['bufferView']]
j['buffers']=[{'byteLength':len(out)}];meta=json.dumps(j,separators=(',',':')).encode();meta+=b' '*((-len(meta))%4);out+=b'\0'*((-len(out))%4)
Path('public/models/keeper.glb').write_bytes(struct.pack('<III',0x46546c67,2,28+len(meta)+len(out))+struct.pack('<II',len(meta),0x4e4f534a)+meta+struct.pack('<II',len(out),0x004e4942)+out)
print('KayKit runtime bytes',28+len(meta)+len(out))
