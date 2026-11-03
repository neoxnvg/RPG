import * as THREE from 'three';
import { createNavigation } from './navigation.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createCity(scene) {
  const root=new THREE.Group();root.name='Cidade de Vespera';scene.add(root);
  const obstacles=[],animated=[],npcs=[],buildings=[];
  let seed=123;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  function texture(type){const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.fillStyle=type==='roof'?'#222b34':'#52575a';ctx.fillRect(0,0,512,512);const h=type==='ground'?32:type==='roof'?24:48,w=type==='ground'?55:88;for(let y=-h;y<512;y+=h)for(let x=-w;x<512;x+=w){const offset=(Math.floor(y/h)%2)*w/2,v=Math.floor(random()*28);ctx.fillStyle=type==='roof'?`rgb(${48+v/2},${58+v/2},${70+v/2})`:`rgb(${66+v},${70+v},${72+v})`;ctx.fillRect(x+offset+2,y+2,w-4,h-4);ctx.strokeStyle='#a9a89930';ctx.strokeRect(x+offset+3,y+3,w-7,h-7);for(let j=0;j<12;j++){ctx.fillStyle='#00000013';ctx.fillRect(x+offset+random()*w,y+random()*h,2+random()*4,1);}}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t;}
  const stoneMap=texture('wall'),roofMap=texture('roof'),groundMap=texture('ground');groundMap.repeat.set(18,20);
  const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.85,...extra});
  const stone=material('#ddd6c9',{map:stoneMap,bumpMap:stoneMap,bumpScale:.12}),trim=material('#686b6c'),roof=material('#b0bccb',{map:roofMap,bumpMap:roofMap,bumpScale:.12,metalness:.2}),gold=material('#c4a565',{metalness:.7,roughness:.45}),wood=material('#4c3026'),red=material('#632c32'),green=material('#354c38'),glow=material('#ffd392',{emissive:'#ff9d35',emissiveIntensity:1.5}),purple=material('#ad8bd4',{emissive:'#8652db',emissiveIntensity:1.1});
  const geometries=new Map();
  function box(w,h,d,m,x,y,z,p=root){const k=`b${w},${h},${d}`;if(!geometries.has(k))geometries.set(k,new THREE.BoxGeometry(w,h,d));return put(geometries.get(k),m,x,y,z,p);}
  function put(g,m,x,y,z,p=root){const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;p.add(mesh);return mesh;}
  function cylinder(r,h,m,x,y,z,p=root,r2=r){return put(new THREE.CylinderGeometry(r,r2,h,10),m,x,y,z,p);}
  function cone(r,h,m,x,y,z,p=root){return put(new THREE.ConeGeometry(r,h,4),m,x,y,z,p);}
  const ground=put(new THREE.PlaneGeometry(210,210),material('#445044'),0,-.15,0);ground.rotation.x=-Math.PI/2;
  const pavement=put(new THREE.PlaneGeometry(86,90),material('#c5c5c0',{map:groundMap,bumpMap:groundMap,bumpScale:.08}),0,.005,0);pavement.rotation.x=-Math.PI/2;
  // Gold-edged processional streets and garden plots establish the reference layout.
  for(const x of [-10,10])box(.12,.035,87,gold,x,.04,0);
  for(const z of [-13,13])box(82,.035,.12,gold,0,.04,z);
  function garden(x,z,w,d){box(w,.18,d,trim,x,.1,z);box(w-.5,.2,d-.5,material('#354436'),x,.15,z);for(let i=0;i<9;i++){const px=x+(random()-.5)*(w-1),pz=z+(random()-.5)*(d-1);put(new THREE.IcosahedronGeometry(.2,0),i%3?green:purple,px,.35,pz);}}
  function tree(x,z,h=5){cylinder(.16,h,wood,x,h/2,z);for(let i=0;i<3;i++)put(new THREE.ConeGeometry(1.1-i*.2,2.6,7),green,x,h-1+i*.8,z);}
  function brazier(x,z){cylinder(.55,.6,trim,x,.3,z);cylinder(.28,1.1,stone,x,1,z);cylinder(.55,.18,gold,x,1.65,z);const flame=put(new THREE.IcosahedronGeometry(.28,1),glow,x,2,z);flame.scale.y=1.8;animated.push({type:'fire',object:flame});}
  function banner(x,y,z,p=root){box(1.2,2.7,.06,red,x,y,z,p);box(1.5,.09,.15,gold,x,y+1.4,z,p);box(.055,1.3,.08,gold,x,y,z+.05,p);box(.65,.055,.08,gold,x,y+.25,z+.05,p);}
  const archGeo=(w,h,depth=.15)=>{const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(-w/2,h*.55);s.quadraticCurveTo(-w/2,h*.8,0,h);s.quadraticCurveTo(w/2,h*.8,w/2,h*.55);s.lineTo(w/2,0);s.closePath();return new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:10});};
  const windowGeo=archGeo(.65,1.8),doorGeo=archGeo(1.7,3);
  function spire(x,z,h,p=root){cylinder(.33,h,trim,x,h/2,z,p);const cap=cone(.65,1.8,roof,x,h+.8,z,p);cap.rotation.y=Math.PI/4;cylinder(.045,.65,gold,x,h+1.9,z,p);}
  function building(name,x,z,w,d,h,{cathedral=false,mage=false,forge=false,inn=false}={}){
    const g=new THREE.Group();g.position.set(x,0,z);root.add(g);buildings.push({name,x,z,w,d});obstacles.push({x,z,w,d});
    box(w+.8,.4,d+.8,trim,0,.2,0,g);box(w,h,d,stone,0,h/2+.4,0,g);
    box(w+.6,.18,d+.6,trim,0,h+.4,0,g);box(w+.4,.2,d+.4,gold,0,.65,0,g);
    // Ridged gable roofs, with repeated slate bands and narrow gold ribs.
    const roofShape=new THREE.Shape();roofShape.moveTo(-w/2-.4,0);roofShape.lineTo(0,w*.38);roofShape.lineTo(w/2+.4,0);roofShape.closePath();const rg=new THREE.ExtrudeGeometry(roofShape,{depth:d+.7,bevelEnabled:false});put(rg,roof,0,h+.5,-d/2-.35,g);
    for(const bx of [-w/2,w/2]){for(const bz of [-d/2,d/2]){box(.5,h+.6,.5,trim,bx,h/2,bz,g);spire(bx,bz,h+1.3,g);}}
    for(let j=0;j<Math.floor(w/2);j++){const wx=-w/2+1.1+j*2;put(windowGeo,mage?purple:glow,wx,1.7,d/2+.02,g);box(.1,1.8,.22,gold,wx,2.6,d/2+.18,g);}
    put(doorGeo,wood,0,.45,d/2+.2,g);const doorway=put(archGeo(2.1,3.4,.2),trim,0,.35,d/2+.02,g);doorway.position.z-=.05;
    for(const dx of [-1.25,1.25]){cylinder(.15,3.4,gold,dx,1.9,d/2+.3,g);}
    box(w+.2,.15,.4,trim,0,h*.55,d/2+.25,g);
    for(const side of [-1,1])for(let i=0;i<Math.floor(d/2);i++){const win=put(windowGeo,mage?purple:glow,side*(w/2+.06),1.7,-d/2+1+i*2,g);win.rotation.y=side*Math.PI/2;}
    if(cathedral){box(5,h+3,3,stone,0,(h+3)/2,d/2+.9,g);put(archGeo(3,5),wood,0,.4,d/2+2.5,g);for(const side of [-1,1]){const tx=side*(w/2-1);box(2,h+5,2.5,stone,tx,(h+5)/2,d/2-.3,g);cone(2,4,roof,tx,h+7,d/2-.3,g).rotation.y=Math.PI/4;banner(tx,6,d/2+1,g);}banner(0,h+1,d/2+2.6,g);for(let i=0;i<6;i++)box(8+i*.6,.18,1,trim,0,.95-i*.14,d/2+3+i*.65,g);}
    if(mage){cylinder(w*.38,2.5,roof,0,h+2,0,g);put(new THREE.SphereGeometry(w*.38,16,12,0,Math.PI*2,0,Math.PI/2),roof,0,h+3.2,0,g);spire(0,0,h+6,g);for(const side of [-1,1])cylinder(.3,3,purple,side*2,h+3,0,g);}
    if(forge){box(2,3,1.5,wood,2,1.5,d/2+.8,g);put(archGeo(1.6,2),glow,2,.4,d/2+1.6,g);box(1.2,h+4,1.2,stone,w/2-1,(h+4)/2,-1,g);box(1.5,.3,1.5,trim,w/2-1,h+4,-1,g);box(1.8,.4,.7,trim,-2,.8,d/2+2,g);}
    if(cathedral){const rose=put(new THREE.TorusGeometry(1.1,.13,6,32),gold,0,8.4,d/2+2.54,g);const glass=put(new THREE.CircleGeometry(.98,24),purple,0,8.4,d/2+2.55,g);for(let i=0;i<8;i++){const rib=box(.045,2,.06,gold,0,8.4,d/2+2.6,g);rib.rotation.z=i*Math.PI/8;}for(const side of [-1,1])for(let i=0;i<3;i++){const x=side*(4.5+i*2.7);box(.35,h+1,.65,trim,x,(h+1)/2,d/2+.3,g);cone(.45,1.5,roof,x,h+1.8,d/2+.3,g).rotation.y=Math.PI/4;}}
    if(inn){box(1.6,2.8,.2,wood,-w/2-1,4,d/2,g);box(2.4,.12,.2,gold,-w/2,5.5,d/2,g);}
    for(const side of [-1,1]){garden(x+side*(w/2+1.5),z,1.4,d+1);tree(x+side*(w/2+1.5),z-d/2,3.5);}
    return g;
  }
  building('Catedral da Aurora',0,-33,22,12,10,{cathedral:true});
  building('Arquivo dos Magos',25,-24,12,10,6,{mage:true});
  building('Guilda dos Guardiões',-25,-3,13,11,7);
  building('Casa do Conselho',-25,-24,11,9,5);
  building('Estalagem do Corvo',-25,21,14,10,5.5,{inn:true});
  building('Forja de Brann',25,21,14,10,5,{forge:true});
  building('Casa dos Viajantes',-25,36,10,7,4);
  // Open-air market, awnings, stocked stalls and crates.
  const market=new THREE.Group();market.position.set(25,0,-3);root.add(market);obstacles.push({x:25,z:-3,w:16,d:5});buildings.push({name:'Mercado das Lanternas',x:25,z:-3,w:16,d:5});
  for(let i=0;i<3;i++){const x=(i-1)*5;box(4,.9,1.8,wood,x,.5,0,market);for(const dx of [-2,2])cylinder(.09,3,wood,x+dx,1.5,0,market);const awning=box(4.6,.12,3.6,i===1?red:material('#947447'),x,3,0,market);awning.rotation.x=.15;for(let j=0;j<6;j++){put(new THREE.SphereGeometry(.16,6,5),j%2?gold:green,x-1.5+j*.5,1.1,.25,market);}box(.7,.7,.7,wood,x+1,.4,1.7,market);}
  // Defensive walls: gate remains open and every battlement is real geometry.
  function tower(x,z){box(2.5,7,2.5,stone,x,3.5,z);box(2.9,.4,2.9,trim,x,7,z);for(const a of [-1,1])for(const b of [-1,1])box(.6,.8,.6,trim,x+a,7.5,z+b);brazier(x,z);put(windowGeo,glow,x-.32,4,z+1.27);}
  function wall(x,z,w,d){box(w,5.5,d,stone,x,2.75,z);box(w+.2,.2,d+.2,trim,x,5.5,z);const len=Math.max(w,d),horizontal=w>d;for(let n=0;n<len;n+=2)box(horizontal?1:1.6,.65,horizontal?1.6:1,trim,x+(horizontal?n-len/2:0),5.9,z+(horizontal?0:n-len/2));}
  wall(-44,0,1.6,90);wall(44,0,1.6,90);wall(0,-46,88,1.6);wall(-26,46,36,1.6);wall(26,46,36,1.6);
  for(const x of [-44,44])for(const z of [-45,-23,0,23,45])tower(x,z);
  for(const x of [-7,7]){tower(x,46);banner(x,4,47.3);spire(x,46,9);}
  box(12,1.6,2.3,trim,0,8,46);const gateArch=put(archGeo(10,9,.7),trim,0,0,46); // Shape outlines a gate; the open arch is built below.
  gateArch.visible=false;
  for(const x of [-5,5])box(1,7,2,stone,x,3.5,46);for(let i=0;i<12;i++){const a=i/11*Math.PI;const voussoir=box(.9,.7,2,stone,Math.cos(a)*4.7,5+Math.sin(a)*2.5,46);voussoir.rotation.z=a-Math.PI/2;}
  // Central compass mosaic with inlaid spokes and emissive sigil.
  const plaza=cylinder(7.5,.04,trim,0,.035,0);
  for(const r of [2.5,5.6,7]){const ring=put(new THREE.TorusGeometry(r,.055,5,80),gold,0,.07,0);ring.rotation.x=Math.PI/2;}
  for(let i=0;i<16;i++){const a=i*Math.PI/8;const spoke=box(.065,.03,13,gold,0,.08,0);spoke.rotation.y=a;}
  const rune=put(new THREE.OctahedronGeometry(.35),material('#a0e9f2',{emissive:'#5bb5d6',emissiveIntensity:1.5}),0,.35,0);animated.push({type:'rune',object:rune});
  for(const [x,z] of [[-10,-13],[10,-13],[-10,13],[10,13],[-6,40],[6,40]])brazier(x,z);
  // Portal in the south avenue.
  const portal=new THREE.Group();portal.position.set(0,0,23);root.add(portal);for(const x of [-2.3,2.3]){box(.6,4.7,.7,trim,x,2.35,0,portal);spire(x,0,5.5,portal);}for(let i=0;i<14;i++){const a=i/13*Math.PI;const segment=box(.65,.6,.7,gold,Math.cos(a)*2.3,3.8+Math.sin(a)*2,0,portal);segment.rotation.z=a-Math.PI/2;}
  const portalMat=material('#79d8ef',{emissive:'#2396c5',emissiveIntensity:1.8,transparent:true,opacity:.45,side:THREE.DoubleSide});const gate=put(archGeo(3.7,5.4,.02),portalMat,0,.1,0,portal);for(const r of [.6,1,1.5]){const ring=put(new THREE.TorusGeometry(r,.04,5,48),portalMat,0,2.5,.1,portal);animated.push({type:'portal',object:ring});}
  // Training court is the only combat area inside the city.
  for(const x of [17,35])box(.2,.6,9,wood,x,.3,35);for(const z of [30.5,39.5])box(18,.6,.2,wood,26,.3,z);
  const npcData=[['Capitã Lyra','Guarda da cidade',-6,35,'#66778d'],['Mira','Mercadora',20,2,'#a16d52'],['Brann','Ferreiro',20,28,'#81564a'],['Irmã Elara','Curandeira',-7,-20,'#d3d4c1'],['Mestre Oren','Instrutor',17,34,'#7e806b']];
  function humanoid(x,z,color){const g=new THREE.Group();g.position.set(x,0,z);root.add(g);const cloth=material(color);put(new THREE.CylinderGeometry(.3,.5,1.05,8),cloth,0,.9,0,g);put(new THREE.SphereGeometry(.23,10,8),material('#c29c82'),0,1.68,0,g);put(new THREE.SphereGeometry(.25,10,8,0,Math.PI*2,0,Math.PI/2),wood,0,1.77,0,g);for(const a of [-1,1]){box(.18,.55,.22,wood,a*.2,.28,0,g);box(.16,.72,.17,cloth,a*.4,1.05,0,g);}return g;}
  for(const [name,role,x,z,color] of npcData){const g=humanoid(x,z,color);const marker=put(new THREE.OctahedronGeometry(.16),gold,0,2.3,0,g);npcs.push({name,role,g,marker});}
  // Bake static architecture by material: detail without thousands of draw calls.
  root.updateMatrixWorld(true);
  const excluded=new Set([ground,pavement,plaza,portal,...npcs.map(n=>n.g),...animated.map(a=>a.object)]),batches=new Map();
  const originals=[];
  root.traverse(o=>{if(!o.isMesh||!o.visible)return;for(let p=o;p&&p!==root;p=p.parent)if(excluded.has(p))return;
    const key=o.material.uuid;if(!batches.has(key))batches.set(key,{material:o.material,geometries:[]});
    const geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geometry.applyMatrix4(o.matrixWorld);batches.get(key).geometries.push(geometry);originals.push(o);
  });
  for(const o of originals)o.removeFromParent();
  for(const batch of batches.values()){const geometry=mergeGeometries(batch.geometries);if(geometry){const combined=new THREE.Mesh(geometry,batch.material);combined.castShadow=true;combined.receiveShadow=true;root.add(combined);}for(const geometry of batch.geometries)geometry.dispose();}
  const navigation=createNavigation(obstacles);
  function update(time){for(const a of animated){if(a.type==='fire'){a.object.scale.y=1.5+Math.sin(time*7+a.object.position.x)*.25;}else if(a.type==='portal')a.object.rotation.z=time*.3;else a.object.rotation.y=time;}for(const npc of npcs)npc.marker.position.y=2.3+Math.sin(time*2)*.12;}
  return {ground:pavement,plaza,portal,portalMat,gate,npcs,buildings,navigation,update,spawn:new THREE.Vector3(0,0,36),portalPosition:new THREE.Vector3(0,0,23)};
}
