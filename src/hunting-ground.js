import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createNavigation} from './navigation.js';
import {FIRST_LAYERS,layerAt} from './maps.js';

// Camps are the encounter unit: each has four defenders, a readable landmark,
// a clear approach from the trail, and enough space for kiting and combos.
const CAMP_NAMES=[
 ['Ninho dos Errantes','Círculo da Seiva','Clareira das Cinzas'],
 ['Toca dos Presas','Pedras do Uivo','Ravina dos Lobos'],
 ['Fogueira dos Exilados','Acampamento dos Chifres','Altar Quebrado'],
 ['Sepulcro da Névoa','Jardim dos Esquecidos','Cripta dos Lamentos'],
 ['Colunas do Juramento','Santuário Profanado','Pátio dos Ossos'],
 ['Forja das Cinzas','Fenda do Guardião','Coração em Brasa']
];
const PALETTES=[
 {soil:'#66745a',stone:'#74786b',leaf:'#596c42',glow:'#88ddb2'},
 {soil:'#706d52',stone:'#736f5f',leaf:'#667048',glow:'#edc477'},
 {soil:'#72574a',stone:'#796355',leaf:'#63543a',glow:'#ff9b4f'},
 {soil:'#535f60',stone:'#767e7b',leaf:'#435e53',glow:'#87dce1'},
 {soil:'#64616b',stone:'#93908d',leaf:'#555768',glow:'#c396ee'},
 {soil:'#514e54',stone:'#665d66',leaf:'#564b50',glow:'#ff986c'}
];

// Procedural surface assets are generated locally: color is SRGB, data maps stay linear.
function createSurface(kind,size=128){
 const hash=(x,y)=>{let v=Math.imul(x+1973,y+9277)^Math.imul(x,374761393);v=Math.imul(v^(v>>>13),1274126177);return (v>>>0)/4294967295;};
 const noise=(u,v,frequency)=>{const x=u*frequency,y=v*frequency,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),a=hash((ix+frequency)%frequency,(iy+frequency)%frequency),b=hash((ix+1+frequency)%frequency,(iy+frequency)%frequency),c=hash((ix+frequency)%frequency,(iy+1+frequency)%frequency),d=hash((ix+1+frequency)%frequency,(iy+1+frequency)%frequency);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,sx),THREE.MathUtils.lerp(c,d,sx),sy);};
 const height=new Float32Array(size*size),color=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4),bump=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,n=noise(u,v,8)*.55+noise(u,v,32)*.3+noise(u,v,64)*.15;let h=n,shade=.65+n*.3,roughness=.85;
  if(kind==='paving'){const row=Math.floor(v*8),gx=u*5+(row%2)*.5,gy=v*8,fx=gx-Math.floor(gx),fy=gy-Math.floor(gy),edge=Math.min(fx,1-fx,fy,1-fy),stone=hash(Math.floor(gx),row);h=THREE.MathUtils.smoothstep(edge,.025,.12)*(.62+stone*.22)+n*.12;shade=.49+h*.34+n*.12;roughness=.69+n*.2;}
  else if(kind==='stone'){const veins=Math.abs(Math.sin(u*36+noise(u,v,4)*8+v*9));h=n*.65+Math.pow(veins,.3)*.22;shade=.58+n*.32+(veins<.08?-.14:0);roughness=.8+n*.16;}
  else if(kind==='bark'){const groove=(Math.sin(u*Math.PI*32+noise(u,v,8)*5)+1)*.5;h=Math.pow(groove,.55)*.7+n*.3;shade=.5+h*.4;roughness=.92;}
  else if(kind==='foliage'){const vein=Math.abs(Math.sin(u*38+Math.sin(v*12)*2));h=n*.4+vein*.25;shade=.6+n*.34;roughness=.67+n*.22;}
  else {h=n*.8+noise(u,v,128)*.2;shade=.52+n*.4;roughness=.84+n*.14;}
  const i=(y*size+x)*4;height[y*size+x]=h;const warm=kind==='soil'?[1.02,1,.86]:kind==='bark'?[1.05,.96,.84]:kind==='foliage'?[.9,1,.85]:[1,1,.97];
  for(let c=0;c<3;c++){color[i+c]=Math.min(255,Math.round(shade*255*warm[c]));rough[i+c]=Math.round(roughness*255);bump[i+c]=Math.round(h*255);}color[i+3]=rough[i+3]=bump[i+3]=255;
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,nx=(height[y*size+(x+size-1)%size]-height[y*size+(x+1)%size])*2.8,ny=(height[((y+size-1)%size)*size+x]-height[((y+1)%size)*size+x])*2.8,l=Math.hypot(nx,ny,1);normal.set([Math.round((nx/l*.5+.5)*255),Math.round((ny/l*.5+.5)*255),Math.round((1/l*.5+.5)*255),255],i);}
 const result={};for(const [channel,data] of Object.entries({albedo:color,normal,roughness:rough,bump})){const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.name=`Vale/${kind}/${channel}`;t.colorSpace=channel==='albedo'?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.anisotropy=4;t.needsUpdate=true;result[channel]=t;}return result;
}
function repeatSurface(surface,x,y){const out={};for(const [key,value] of Object.entries(surface)){const t=value.clone();t.repeat.set(x,y);t.needsUpdate=true;out[key]=t;}return out;}
const surfaceMaps=s=>({map:s.albedo,normalMap:s.normal,roughnessMap:s.roughness,bumpMap:s.bump});

export function createHuntingGround(scene){
 const root=new THREE.Group();root.name='Vale das Cinzas · territórios de caça';root.visible=false;scene.add(root);
 const obstacles=[],layers=FIRST_LAYERS,hotspots=[],spawns=[],animated=[],waterSurfaces=[];
 let seed=52;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const mats=new Map(),glows=new Map(),foliageMats=new Map(),windGeometries=new Map(),windTime={value:0};
 const surfaces={soil:createSurface('soil',256),paving:createSurface('paving',256),stone:createSurface('stone'),bark:createSurface('bark'),foliage:createSurface('foliage')};
 const stoneColors=new Set(PALETTES.map(p=>p.stone));
 const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.94,...extra});
 const solid=color=>{if(!mats.has(color))mats.set(color,material(color,stoneColors.has(color)?{...surfaceMaps(surfaces.stone),normalScale:new THREE.Vector2(.65,.65),bumpScale:.11}:{}));return mats.get(color);};
 function foliage(color){if(!foliageMats.has(color)){const m=material(color,{...surfaceMaps(surfaces.foliage),side:THREE.DoubleSide,roughness:.84,normalScale:new THREE.Vector2(.22,.22),bumpScale:.045});m.userData.wind=true;m.onBeforeCompile=shader=>{shader.uniforms.windTime=windTime;shader.vertexShader='uniform float windTime;\nattribute float windWeight;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat breeze=sin(windTime*1.15+transformed.x*.43+transformed.z*.31); transformed.x+=breeze*windWeight*.15; transformed.z+=cos(windTime*.8+transformed.x*.35)*windWeight*.09;');};m.customProgramCacheKey=()=> 'vale-foliage-wind-v1';foliageMats.set(color,m);}return foliageMats.get(color);}
 const stone=material('#a3a69d',{...surfaceMaps(surfaces.stone),bumpScale:.16,normalScale:new THREE.Vector2(.75,.75)}),wood=material('#85705b',{...surfaceMaps(surfaces.bark),bumpScale:.18,normalScale:new THREE.Vector2(.8,.8)}),gold=material('#c1a56a',{metalness:.75,roughness:.3,...surfaceMaps(surfaces.stone),bumpScale:.025,normalScale:new THREE.Vector2(.16,.16)});
 const cube=new THREE.BoxGeometry(1,1,1),rockGeometry=new THREE.IcosahedronGeometry(1,2),pebbleGeometry=new THREE.IcosahedronGeometry(1,1),crownGeometry=new THREE.IcosahedronGeometry(1,1),bladeGeometry=new THREE.BufferGeometry();
 for(const shape of [rockGeometry,pebbleGeometry]){const rv=shape.attributes.position;for(let i=0;i<rv.count;i++){const x=rv.getX(i),y=rv.getY(i),z=rv.getZ(i),d=1+Math.sin(x*7+y*3)*Math.cos(z*5-x*3)*.11;rv.setXYZ(i,x*d,y*(1+Math.cos(x*6+z*4)*.09),z*d);}} // Smooth eroded shapes, with geometric variation below the PBR detail.
 const bp=[],bu=[];for(let k=0;k<5;k++){const a=k*Math.PI*.42,dx=Math.cos(a)*.1,dz=Math.sin(a)*.1,h=.75+(k%3)*.16,tipX=Math.cos(a+.4)*.25,tipZ=Math.sin(a+.4)*.25;bp.push(-dx,0,-dz,dx,0,dz,tipX,h,tipZ);bu.push(0,0,1,0,.5,1);}bladeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(bp,3));bladeGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(bu,2));bladeGeometry.computeVertexNormals();
 function limb(ax,ay,az,bx,by,bz,radius,tip=.4,m=wood){const from=new THREE.Vector3(ax,ay,az),to=new THREE.Vector3(bx,by,bz),delta=to.clone().sub(from),o=put(new THREE.CylinderGeometry(radius*tip,radius,delta.length(),8,2),m,(ax+bx)/2,(ay+by)/2,(az+bz)/2);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;}

 function put(g,m,x,y,z){if(m.userData.wind&&!g.attributes.windWeight){if(!windGeometries.has(g.uuid)){const copy=g.clone(),p=copy.attributes.position,weights=new Float32Array(p.count);for(let i=0;i<p.count;i++)weights[i]=THREE.MathUtils.clamp((p.getY(i)+.2)*.8,0,1);copy.setAttribute('windWeight',new THREE.BufferAttribute(weights,1));windGeometries.set(g.uuid,copy);}g=windGeometries.get(g.uuid);}const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;}
 function box(w,h,d,m,x,y,z){const o=put(cube,m,x,y,z);o.scale.set(w,h,d);return o;}
 function rock(x,z,r,m=stone){const o=put(r>2.5?rockGeometry:pebbleGeometry,m,x,r*.28,z);o.scale.set(r,r*(.45+rand()*.4),r*.8);o.rotation.set(rand()*.5,rand()*6.28,rand()*.4);return o;}
 function floor(g,m,x,z,y=.025){const o=put(g,m,x,y,z);o.rotation.x=-Math.PI/2;o.castShadow=false;return o;}
 const terrain=repeatSurface(surfaces.soil,22,44),terrainDetail=repeatSurface(surfaces.soil,.16,.16),paving=repeatSurface(surfaces.paving,1,2);
 const ground=floor(new THREE.PlaneGeometry(130,260),material('#c0c4a3',{...surfaceMaps(terrain),bumpScale:.2,normalScale:new THREE.Vector2(.7,.7)}),0,0,0);
 const campFloorMaterials=PALETTES.map(p=>material(p.soil,{...surfaceMaps(terrainDetail),bumpScale:.12,normalScale:new THREE.Vector2(.7,.7)}));
 const campRingMaterials=PALETTES.map(p=>new THREE.MeshBasicMaterial({color:p.glow,transparent:true,opacity:.19,depthWrite:false,blending:THREE.AdditiveBlending}));
 const dirt=material('#827f75',{...surfaceMaps(paving),roughness:.86,bumpScale:.22,normalScale:new THREE.Vector2(.9,.9)}),roadEdge=material('#8d8d7b',{...surfaceMaps(surfaces.stone),bumpScale:.11});
 // A winding, continuous stone trail replaces the former rectangular bands.
 function trail(ax,az,bx,bz,width=5){const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz),o=box(width,.035,length,dirt,(ax+bx)/2,.026,(az+bz)/2);o.rotation.y=Math.atan2(dx,dz);o.castShadow=false;}
 for(let z=-121;z<122;z+=8){const x=Math.sin(z*.035)*2,nx=Math.sin((z+8)*.035)*2;trail(x,z,nx,z+8,6.5);for(const side of [-1,1]){const p=box(.55,.13,3.2,roadEdge,x+side*3.65,.05,z+3);p.rotation.y=(rand()-.5)*.15;}}
 function patch(x,z,rx,rz,m,vertices=24,depth=.012){
  // Vertex alpha feathers each biome into the base terrain, without hard polygon seams.
  const positions=[0,0,0],uvs=[0,0],colors=[1,1,1,1],indices=[],edge=Array.from({length:vertices},()=>.9+rand()*.16);
  for(const radius of [.52,.83,1.08])for(let n=0;n<vertices;n++){const a=n/vertices*Math.PI*2,px=Math.cos(a)*rx*radius*edge[n],pz=Math.sin(a)*rz*radius*edge[n];positions.push(px,pz,0);uvs.push(px,pz);colors.push(1,1,1,radius>1?0:radius>.8?.62:1);}
  for(let n=0;n<vertices;n++){const next=(n+1)%vertices;indices.push(0,1+n,1+next);for(let ring=0;ring<2;ring++){const a=1+ring*vertices+n,b=1+ring*vertices+next,c=a+vertices,d=b+vertices;indices.push(a,c,b,b,c,d);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));g.setIndex(indices);g.computeVertexNormals();m.vertexColors=true;m.transparent=true;m.depthWrite=false;return floor(g,m,x,z,depth);
 }
 for(let layer=0;layer<6;layer++){
  const centerZ=100-layer*40,p=PALETTES[layer];
  patch(0,centerZ,62,20,material(p.soil,{...surfaceMaps(terrainDetail),transparent:true,opacity:.38,depthWrite:false}));
  const campCenters=[[-11-(layer%2)*5,centerZ+5],[29+(layer%2)*4,centerZ],[ -31+(layer%2)*5,centerZ-12]];
  for(let camp=0;camp<3;camp++){
   const [x,z]=campCenters[camp],id=`hotspot-${layer+1}-${camp+1}`;
   hotspots.push({id,name:CAMP_NAMES[layer][camp],layer,x,z,center:{x,z},radius:9,levelMin:layers[layer].min,levelMax:layers[layer].max,color:p.glow});
   trail(Math.sin(z*.035)*2,z,x,z,3.1);
   patch(x,z,11.3,9.7,campFloorMaterials[layer],15,.018);
   for(let n=0;n<4;n++){const angle=Math.PI/4+n*Math.PI/2,spread=4.35;spawns.push({layer,x:x+Math.cos(angle)*spread,z:z+Math.sin(angle)*spread,rank:Math.min(4,camp+n%3),hotspotId:id});}
   // Broken perimeter stones mark the camp, leaving both approaches open.
   for(let n=0;n<9;n++){const a=n/9*Math.PI*2;if(Math.abs(Math.sin(a))<.35)continue;rock(x+Math.cos(a)*10.2,z+Math.sin(a)*9.2,.45+rand()*.45,solid(p.stone));}
   const nest=floor(new THREE.RingGeometry(6.8,6.96,32),campRingMaterials[layer],x,z,.06);nest.userData.themeEffect=true;
   for(const side of [-1,1]){const tx=x+side*7.4,tz=z+1.5;box(.38,1.25,.38,wood,tx,.625,tz);box(.7,.18,.7,gold,tx,1.22,tz);flame(tx,tz,p.glow,.48,1.58,false);obstacles.push({x:tx,z:tz,w:.7,d:.7});}
   if(layer===0||layer===1){floor(new THREE.RingGeometry(.9,1.3,13),solid(layer===0?'#8d8358':'#b6a38a'),x,z,.04);for(let n=0;n<3;n++)rock(x+(n-1)*.55,z,.25,solid(p.stone));}
   else if(layer===2){for(let n=0;n<3;n++){const log=box(.22,.15,2,wood,x,.14,z);log.rotation.y=n*Math.PI/3;}flame(x,z,p.glow,.65);}
   else{floor(new THREE.RingGeometry(1.35,1.48,layer===4?6:12),glow(p.glow),x,z,.07);const symbol=box(.15,.04,2.2,gold,x,.06,z);symbol.castShadow=false;const cross=box(2.2,.04,.15,gold,x,.06,z);cross.castShadow=false;}

  }
 }
 const inCamp=(x,z,padding=0)=>hotspots.some(h=>Math.hypot(x-h.x,z-h.z)<h.radius+padding);
 function obstruct(x,z,w,d){obstacles.push({x,z,w,d});}
 function roots(x,z,scale){for(let n=0;n<5;n++){const a=n/5*Math.PI*2,reach=(1.1+rand()*.7)*scale;limb(x,.5*scale,z,x+Math.cos(a)*reach,.06,z+Math.sin(a)*reach,.2*scale,.12);}}
 function pine(x,z,scale,palette){
  roots(x,z,scale);const bend=(rand()-.5)*.65*scale,height=(5.5+rand()*1.7)*scale;limb(x,.05,z,x+bend,height*.62,z,.37*scale,.58);limb(x+bend,height*.62,z,x+bend*.4,height,z+.25*scale,.23*scale,.13);
  const variant=Math.floor(rand()*3),leaf=foliage(palette.leaf),highlight=foliage(new THREE.Color(palette.leaf).lerp(new THREE.Color('#a2ac72'),.18).getStyle());
  for(let n=0;n<7;n++){const a=n*2.399+rand()*.45,level=n/7,bh=height*(.4+level*.43),reach=(variant===0?2.1-level*.65:1.8)*scale,ex=x+Math.cos(a)*reach,ez=z+Math.sin(a)*reach,ey=bh+(.7+rand()*.4)*scale;limb(x+bend*.6,bh,z,ex,ey,ez,.12*scale,.15);const crown=put(crownGeometry,n%3?leaf:highlight,ex,ey+.35*scale,ez);crown.scale.set((1.2+rand()*.4)*scale,(variant===2?.8:1.2)*scale,(1.1+rand()*.3)*scale);crown.rotation.set(rand()*.5,a,rand()*.4);crown.castShadow=false;}
  const top=put(crownGeometry,highlight,x+bend*.4,height,z+.25*scale);top.scale.set(1.15*scale,1.3*scale,1.1*scale);top.castShadow=false;obstruct(x,z,.95*scale,.95*scale);
 }
 function deadTree(x,z,size,palette){
  roots(x,z,size);const bend=(rand()-.5)*1.2*size;limb(x,.05,z,x+bend,4.8*size,z,.35*size,.24);for(let n=0;n<5;n++){const a=n*2.4,h=(2.5+n*.38)*size,ex=x+Math.cos(a)*(1.2+rand())*size,ez=z+Math.sin(a)*1.4*size;limb(x+bend*h/(4.8*size),h,z,ex,h+1.2*size,ez,.13*size,.12);limb(ex,h+1.2*size,ez,ex+Math.cos(a+.5)*.6*size,h+1.7*size,ez+Math.sin(a+.5)*.5*size,.06*size,.08);}rock(x,z,.7*size,solid(palette.stone));obstruct(x,z,.95*size,.95*size);
 }
 // Rich scenery is kept outside encounter circles and the walking routes.
 for(let n=0;n<430;n++){
  const x=(rand()-.5)*117,z=-122+rand()*242;if(Math.abs(x)<7.5||z>114||inCamp(x,z,3.4))continue;
  const layer=layerAt(z),p=PALETTES[layer],size=.65+rand()*.65;if(Math.hypot(x-12,z-(100-layer*40))<9)continue;
  // Horizontal camp approaches remain navigable even between clusters.
  if(hotspots.some(h=>Math.abs(z-h.z)<3&&x>Math.min(0,h.x)-2&&x<Math.max(0,h.x)+2))continue;
  if(n%4===0){if(layer<3)pine(x,z,size,p);else deadTree(x,z,size,p);}
  else if(n%4===1){const r=.65+rand()*1.5;rock(x,z,r,solid(p.stone));obstruct(x,z,r*1.6,r*1.5);}
  else {for(let k=0;k<3;k++){const grass=put(bladeGeometry,foliage(p.leaf),x+(rand()-.5)*1.4,.25,z+(rand()-.5)*1.4);grass.scale.set(.7,.65+rand()*.5,.7);grass.rotation.z=(rand()-.5)*.7;grass.castShadow=false;}}
 }
 // Small groves frame each territory close to the camera, while keeping the trail open.
 for(let region=0;region<6;region++)for(const side of [-1,1])for(let tree=0;tree<3;tree++){const x=side*(10.5+tree*2.3),z=100-region*40-18+(tree%2)*2.5;if(inCamp(x,z,1.5))continue;if(region<3||tree===0)pine(x,z,.85+tree*.08,PALETTES[region]);else deadTree(x,z,.9+tree*.1,PALETTES[region]);}
 // Fallen limbs, fern beds and broken masonry make the arrival feel inhabited.
 pine(-13,119,1.05,PALETTES[0]);pine(18,123,.92,PALETTES[0]);pine(19,109,1.08,PALETTES[0]);
 limb(-8,.25,115,-10,.38,112,.32,.7);limb(-9,.36,113.5,-10.8,.2,113,.12,.1);
 for(let n=0;n<15;n++){const a=n*2.399,x=-8+Math.cos(a)*(1+rand()*2),z=116+Math.sin(a)*2;const fern=put(bladeGeometry,foliage('#849563'),x,.04,z);fern.scale.set(.8,.55+rand()*.6,.8);fern.rotation.y=a;fern.castShadow=false;}
 for(let n=0;n<7;n++){const fragment=box(.7+rand()*.4,.25+rand()*.25,.55,stone,7.5+rand()*2,.12,110+n*.7);fragment.rotation.set(rand()*.1,rand(),rand()*.15);}
 // Low roadside plants add detail around the player's first steps without collision.
 for(let n=0;n<230;n++){const z=-119+rand()*235,side=n%2?1:-1,x=Math.sin(z*.035)*2+side*(4.8+rand()*3.4),p=PALETTES[layerAt(z)];for(let k=0;k<3;k++){const blade=put(bladeGeometry,foliage(p.leaf),x+(rand()-.5)*.7,.18,z+(rand()-.5)*.8);blade.scale.set(.6,.5+rand()*.45,.6);blade.rotation.z=(rand()-.5)*.8;blade.castShadow=false;}if(n%7===0){const flower=put(new THREE.IcosahedronGeometry(.12,0),solid(n%2?'#c7aa65':'#9caeab'),x,.55,z);flower.castShadow=false;}}
 // The valley has rocky edges and distant silhouettes, instead of ending at a flat tile.
 for(const side of [-1,1])for(let z=-125;z<126;z+=8){const x=side*(62+rand()*3),r=3+rand()*3;rock(x,z,r,solid(PALETTES[layerAt(z)].stone));obstruct(x,z,r*1.4,r*1.3);if(z%3===0)pine(side*58,z,.9+rand()*.5,PALETTES[layerAt(z)]);if(z%16===3){const cliff=rock(side*71,z-3,8+rand()*3,stone);cliff.scale.y*=1.65;cliff.rotation.z=side*.17;}}
 function glow(color){if(!glows.has(color))glows.set(color,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));return glows.get(color);}
 function flame(x,z,color,size=1,height=1.2*size,moving=true){const m=glow(color),outer=put(new THREE.OctahedronGeometry(.4,0),m,x,height,z);outer.scale.set(.75*size,1.7*size,.75*size);outer.userData.dynamic=moving;if(moving)animated.push({mesh:outer,base:outer.position.y,phase:rand()*6,scale:size});return outer;}
 function column(x,z,height,p){
  const m=solid(p.stone);box(1.85,.24,1.85,m,x,.12,z);box(1.6,.22,1.6,m,x,.35,z);box(1.3,.22,1.3,m,x,.57,z);put(new THREE.CylinderGeometry(.48,.65,height-.4,12),m,x,height/2+.5,z);
  for(const y of [.8,height+.28]){const ring=put(new THREE.TorusGeometry(y===.8?.64:.53,.08,5,16),gold,x,y,z);ring.rotation.x=Math.PI/2;}
  for(let n=0;n<8;n++){const a=n/8*Math.PI*2;put(new THREE.CylinderGeometry(.048,.06,height-.5,4),m,x+Math.cos(a)*.52,height/2+.5,z+Math.sin(a)*.52);}
  box(1.35,.22,1.35,gold,x,height+.48,z);box(1.55,.2,1.55,m,x,height+.7,z);
  for(const side of [-1,1]){const scroll=put(new THREE.TorusGeometry(.2,.07,4,9,Math.PI*1.6),gold,x+side*.46,height+.33,z+.49);scroll.rotation.z=side*.4;}
  obstruct(x,z,1.9,1.9);
 }
 function ornamentedArch(x,z,y,radius,p){
  const count=15,angle=Math.PI/count,shape=new THREE.Shape(),inner=radius-.3,outer=radius+.3;shape.absarc(0,0,outer,.008,angle-.008,false);shape.lineTo(Math.cos(angle-.008)*inner,Math.sin(angle-.008)*inner);shape.absarc(0,0,inner,angle-.008,.008,true);shape.closePath();
  const wedge=new THREE.ExtrudeGeometry(shape,{depth:.72,steps:1,curveSegments:3,bevelEnabled:true,bevelSegments:1,bevelSize:.045,bevelThickness:.04});
  for(let n=0;n<count;n++){const stone=put(wedge,solid(p.stone),x,y,z-.38);stone.rotation.z=n*angle;}
  for(const side of [-1,1]){const trim=put(new THREE.TorusGeometry(radius+side*.34,.055,5,40,Math.PI),gold,x,y,z-.44);trim.castShadow=false;}
  const crest=put(new THREE.OctahedronGeometry(.38,0),gold,x,y+radius+.35,z-.5);crest.scale.y=1.5;
 }
 for(let layer=0;layer<6;layer++){
  const p=PALETTES[layer],z=100-layer*40,x=12;
  // One landmark per region is visible from the trail, with a distinct silhouette.
  if(layer===0){
   for(const side of [-1,1])column(x+side*2.5,z,4.5,p);box(7,.7,1.8,solid(p.stone),x,5.2,z);flame(x,z,p.glow,1.7);
   const waterNormal=surfaces.stone.normal.clone();waterNormal.repeat.set(1.7,1.7);waterNormal.needsUpdate=true;waterSurfaces.push(waterNormal);const pool=floor(new THREE.CircleGeometry(4.8,48),material('#539e96',{metalness:.32,roughness:.14,normalMap:waterNormal,normalScale:new THREE.Vector2(.25,.25),emissive:'#204b48',emissiveIntensity:.16,transparent:true,opacity:.91}),x,z,.075);pool.userData.themeEffect=true;for(let n=0;n<16;n++){const a=n/16*Math.PI*2,border=box(1.65,.35,.48,stone,x+Math.cos(a)*4.8,.12,z+Math.sin(a)*4.8);border.rotation.y=-a+Math.PI/2;}
  }else if(layer===1){
   for(let n=0;n<5;n++){const a=n/5*Math.PI*2,r=3;const menhir=rock(x+Math.cos(a)*r,z+Math.sin(a)*r,1.7,solid(p.stone));menhir.scale.y=3+rand();obstruct(x+Math.cos(a)*r,z+Math.sin(a)*r,1.8,1.8);}flame(x,z,p.glow,1.3);
  }else if(layer===2){
   for(const side of [-1,1]){const tent=put(new THREE.ConeGeometry(2.9,3.4,4,1,true),solid('#6e3930'),x,1.7,z+side*5);tent.rotation.y=Math.PI/4;box(.2,4.1,.2,wood,x,2,z+side*5);obstruct(x,z+side*5,4,4);}
   for(let n=0;n<7;n++){const a=n/7*Math.PI*2;rock(x+Math.cos(a)*1.4,z+Math.sin(a)*1.4,.5);}flame(x,z,'#ffb268',1.5);
  }else if(layer===3){
   for(let n=0;n<9;n++){const gx=x+(n%3-1)*3,gz=z+(Math.floor(n/3)-1)*3,head=box(.9,1.6,.35,solid(p.stone),gx,.8,gz);head.rotation.z=(rand()-.5)*.25;box(1.4,.3,.4,solid(p.stone),gx,1.1,gz);obstruct(gx,gz,1.4,.7);}flame(x,z-5,p.glow,1.3);
  }else if(layer===4){
   for(let n=0;n<5;n++){const a=(n/4)*Math.PI;column(x+Math.cos(a)*4,z+Math.sin(a)*4,4.3+(n%2)*1.7,p);}
   box(4,.6,3,solid(p.stone),x,.3,z);flame(x,z,p.glow,2);
  }else{
   for(let n=0;n<6;n++){const a=n/6*Math.PI*2,spike=put(new THREE.ConeGeometry(1.3,5+n%3,5),solid(p.stone),x+Math.cos(a)*4,2.5,z+Math.sin(a)*4);spike.rotation.z=Math.cos(a)*.25;obstruct(spike.position.x,spike.position.z,1.8,1.8);}
   const crystal=put(new THREE.OctahedronGeometry(1.3),glow(p.glow),x,3,z);crystal.userData.dynamic=true;animated.push({mesh:crystal,base:3,phase:2,scale:1,crystal:true});
   for(let n=0;n<4;n++){const crack=box(.18,.04,7,glow(p.glow),x+(n-1.5)*1.8,.05,z);crack.rotation.y=(n-1.5)*.32;crack.castShadow=false;}
  }
  // A waystone at each change of territory points deeper into the same map.
  for(const side of [-1,1]){const sx=side*5.8,sz=z-17;box(.6,2.5,.6,solid(p.stone),sx,1.25,sz);const cap=put(new THREE.OctahedronGeometry(.32),glow(p.glow),sx,2.65,sz);cap.castShadow=false;}
 }
 // Arrival camp and a fully three-dimensional return portal.
 const portalMaterial=glow('#8be4e7'),portalPosition=new THREE.Vector3(0,0,122);
 const arrivalTent=put(new THREE.ConeGeometry(2.7,3.5,4,1,true),solid('#477271'),11,1.75,117);arrivalTent.rotation.y=Math.PI/4;obstruct(11,117,4,4);box(.2,4.2,.2,wood,11,2.1,117);
 for(let n=0;n<3;n++){const crate=box(1.1,.9,1,wood,14+n%2*1.2,.45,114+Math.floor(n/2)*1.1);crate.rotation.y=.2;obstruct(crate.position.x,crate.position.z,1.1,1);}
 for(const side of [-1,1]){const x=side*6.5;box(.8,1.1,.8,stone,x,.55,119);flame(x,119,'#8be4e7',.65,1.5);for(let n=0;n<4;n++){const shrub=put(crownGeometry,foliage('#71895b'),x+side*1.8,.3,115+n*.9);shrub.scale.set(.7,.5,.6);shrub.castShadow=false;}}

 for(const x of [-3.3,3.3]){column(x,122,4.8,PALETTES[0]);put(new THREE.ConeGeometry(.8,1.5,4),gold,x,5.6,122);}
 ornamentedArch(0,122,2.65,2.65,PALETTES[0]);box(8,.18,3,stone,0,.09,122);for(let n=0;n<3;n++)box(7.3-n*.25,.08,1.1,stone,0,.04+n*.07,120.6+n*.4);
 const gate=put(new THREE.CircleGeometry(2.5,36),new THREE.MeshBasicMaterial({color:'#77d7df',transparent:true,opacity:.22,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}),0,2.65,122);gate.scale.x=.86;gate.userData.dynamic=true;gate.castShadow=false;
 for(let n=0;n<2;n++){const ring=put(new THREE.TorusGeometry(1.85+n*.32,.028,4,48),portalMaterial,0,2.65,121.96);ring.userData.dynamic=true;ring.castShadow=false;animated.push({mesh:ring,portal:true,phase:n});}
 // The far end visibly leads into the next territory; access is handled by the world.
 for(const x of [-4.2,4.2]){column(x,-122,5.2,PALETTES[5]);flame(x,-121,'#c8a1ef',1.3);}ornamentedArch(0,-122,2.8,3.45,PALETTES[5]);
 const exitRune=floor(new THREE.RingGeometry(2.5,2.63,40),glow('#b998e0'),0,-121,.055);exitRune.userData.themeEffect=true;
 // One GPU-driven point field supplies fireflies, mist sparks and camp embers.
 const count=480,positions=new Float32Array(count*3),colors=new Float32Array(count*3),phases=new Float32Array(count),sizes=new Float32Array(count);
 for(let n=0;n<count;n++){const h=hotspots[n%hotspots.length],p=PALETTES[h.layer],c=new THREE.Color(p.glow),a=rand()*Math.PI*2,r=2+rand()*10;positions.set([h.x+Math.cos(a)*r,.2+rand()*3.8,h.z+Math.sin(a)*r],n*3);colors.set([c.r,c.g,c.b],n*3);phases[n]=rand()*Math.PI*2;sizes[n]=.4+rand()*.9;}
 const moteGeometry=new THREE.BufferGeometry();moteGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));moteGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));moteGeometry.setAttribute('phase',new THREE.BufferAttribute(phases,1));moteGeometry.setAttribute('moteSize',new THREE.BufferAttribute(sizes,1));
 const moteMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,uniforms:{time:{value:0}},vertexShader:`attribute float phase; attribute float moteSize; uniform float time; varying vec3 vColor; varying float vAlpha; void main(){vec3 p=position;p.x+=sin(time*.35+phase)*.65;p.z+=cos(time*.26+phase)*.55;p.y+=sin(time*.65+phase)*.35;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(moteSize*3.8,1.5,5.);vColor=color;vAlpha=.35+.3*sin(time*1.2+phase);}`,fragmentShader:`varying vec3 vColor; varying float vAlpha; void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(0.,.5,d);gl_FragColor=vec4(vColor,a*a*vAlpha);}`});
 const motes=new THREE.Points(moteGeometry,moteMaterial);motes.name='Faíscas dos territórios';motes.frustumCulled=false;root.add(motes);
 // Bake static scenery by material. Effects and portal rings remain animated.
 root.updateMatrixWorld(true);const batches=new Map(),old=[],originals=new Set();
 root.traverse(o=>{if(!o.isMesh||o===ground||o.userData.dynamic)return;const section=THREE.MathUtils.clamp(Math.floor((o.position.z+130)/40),0,6),sectionX=THREE.MathUtils.clamp(Math.floor((o.position.x+72)/48),0,2),key=`${o.material.uuid}:${o.castShadow}:${o.receiveShadow}:${section}:${sectionX}`;if(!batches.has(key))batches.set(key,{m:o.material,g:[],cast:o.castShadow,receive:o.receiveShadow});const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);batches.get(key).g.push(g);old.push(o);originals.add(o.geometry);});
 for(const o of old)o.removeFromParent();for(const b of batches.values()){const merged=mergeGeometries(b.g);if(merged){merged.computeBoundingSphere();const o=new THREE.Mesh(merged,b.m);o.userData.sceneryBatch=true;o.castShadow=b.cast;o.receiveShadow=b.receive;root.add(o);}b.g.forEach(g=>g.dispose());}originals.forEach(g=>g.dispose());
 const navigation=createNavigation(obstacles,{minX:-61,maxX:61,minZ:-125,maxZ:127});
 root.userData.visualDetail={surfaces:Object.keys(surfaces),treeVariants:3,wind:true};
 const materials=new Set();root.traverse(o=>{if(o.isMesh&&o.material.color){materials.add(o.material);o.material.userData.baseColor=o.material.color.clone();}});
 return {root,ground,navigation,hotspots,spawns,layers,spawn:new THREE.Vector3(0,0,114),portalPosition,layerAt,
  setTheme(second){for(const m of materials)m.color.copy(m.userData.baseColor).lerp(new THREE.Color('#386b4a'),second?.29:0);},
  update(time){windTime.value=time;for(const normal of waterSurfaces)normal.offset.set(time*.018,time*.009);gate.material.opacity=.19+Math.sin(time*1.7)*.045;moteMaterial.uniforms.time.value=time;let pulse=0;for(const m of glows.values())m.opacity=.78+Math.sin(time*2+pulse++)*.12;for(const item of animated){if(item.portal){item.mesh.rotation.z=time*(item.phase?-.15:.2);continue;}item.mesh.position.y=item.base+Math.sin(time*2+item.phase)*.16;item.mesh.rotation.y=time*(item.crystal?.45:.8)+item.phase;item.mesh.scale.y=(item.crystal?1:1.7*item.scale)*(1+Math.sin(time*5+item.phase)*.12);}}
 };
}

export function createMob(kind,tier=0){
 const root=new THREE.Group(),limbs=[];const colors=['#758163','#88765a','#8b4d3a','#756d73','#a0a49b','#59596d'];const body=new THREE.MeshStandardMaterial({color:colors[tier],roughness:.8}),dark=new THREE.MeshStandardMaterial({color:'#26292c',roughness:.8}),bone=new THREE.MeshStandardMaterial({color:'#bdb095',roughness:.8}),eye=new THREE.MeshBasicMaterial({color:tier>2?'#d98bff':'#f5a45d'});
 function part(g,m,x,y,z,sx=1,sy=1,sz=1){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=false;root.add(o);return o;}
 const sphere=(x,y,z,sx,sy,sz,m=body)=>part(new THREE.IcosahedronGeometry(1,1),m,x,y,z,sx,sy,sz);
 if(kind==='crawler'){sphere(0,.55,0,.65,.4,.85);for(const side of [-1,1])for(let i=0;i<3;i++){const leg=part(new THREE.ConeGeometry(.1,.9,4),dark,side*.65,.3,(i-1)*.5);leg.rotation.z=side*.9;limbs.push(leg);}sphere(0,.65,.7,.4,.3,.3);}
 else if(kind==='wolf'){sphere(0,.8,0,.45,.5,.9);sphere(0,1.25,.7,.33,.4,.4);sphere(0,1.1,1,.23,.2,.35,dark);for(const side of [-1,1]){part(new THREE.ConeGeometry(.17,.4,4),body,side*.22,1.7,.7);for(const z of [-.6,.55])limbs.push(part(new THREE.BoxGeometry(.18,.65,.22),dark,side*.3,.35,z));}const tail=part(new THREE.ConeGeometry(.2,.8,6),body,0,.95,-1);tail.rotation.x=-1;}
 else{sphere(0,1.15,0,tier===5?.65:.4,.6,.28);sphere(0,2,0,.28,.35,.28,tier===4?bone:body);for(const side of [-1,1]){limbs.push(part(new THREE.BoxGeometry(.23,1,.24),tier===4?bone:dark,side*.25,.5,0));const arm=part(new THREE.BoxGeometry(.22,.9,.23),tier===4?bone:body,side*.6,1.2,0);arm.rotation.z=side*.2;limbs.push(arm);if(tier>=2){const horn=part(new THREE.ConeGeometry(.13,.6,5),bone,side*.24,2.4,0);horn.rotation.z=-side*.5;}}if(tier===5){part(new THREE.OctahedronGeometry(.3),eye,0,1.35,.35);for(const side of [-1,1])part(new THREE.ConeGeometry(.25,.9,5),bone,side*.65,1.9,0);}}
 for(const side of [-1,1])sphere(side*.12,kind==='crawler'?.73:kind==='wolf'?1.35:2.08,kind==='crawler'?.94:kind==='wolf'?1.02:.25,.065,.05,.05,eye);
 const hitbox=new THREE.Mesh(new THREE.CapsuleGeometry(.65,1.1,3,5),new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,transparent:true,opacity:0}));hitbox.position.y=1.1;root.add(hitbox);
 let action='Idle';return {root,dispose(){const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();},animate(name){action=name;},update(dt,time){for(let i=0;i<limbs.length;i++)limbs[i].rotation.x=action==='Walking'?Math.sin(time*7+i*Math.PI)*.3:Math.sin(time*2+i)*.025;}};
}
