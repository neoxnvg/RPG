import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createNavigation} from './navigation.js';
import {FIRST_LAYERS,layerAt} from './maps.js';

export function createHuntingGround(scene){
 const root=new THREE.Group();root.name='Terras de evolução';root.visible=false;scene.add(root);const obstacles=[],layers=FIRST_LAYERS;
 const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.9,...extra});const stone=material('#55565a'),wood=material('#3e342d'),leaf=material('#3e4940'),gold=material('#9a8057');
 function put(g,m,x,y,z){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;}
 const box=(w,h,d,m,x,y,z)=>put(new THREE.BoxGeometry(w,h,d),m,x,y,z);
 let seed=52;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#6a675c';ctx.fillRect(0,0,256,256);for(let i=0;i<8500;i++){ctx.fillStyle=i%3?'#2b2b2518':'#ada18422';ctx.fillRect(rand()*256,rand()*256,1+rand()*5,1+rand()*3);}const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(18,35);texture.colorSpace=THREE.SRGBColorSpace;
 const ground=put(new THREE.PlaneGeometry(130,260),material('#a7a091',{map:texture,bumpMap:texture,bumpScale:.08}),0,0,0);ground.rotation.x=-Math.PI/2;
 const colors=['#788269','#76725d','#746454','#68645e','#686978','#5d555c'];
 for(let i=0;i<6;i++){const z=100-i*40;const tile=put(new THREE.PlaneGeometry(128,39.7),material(colors[i],{map:texture}),0,.003,z);tile.rotation.x=-Math.PI/2;box(128,.04,.25,gold,0,.025,z-20);for(const side of [-1,1]){box(.5,3,.5,stone,side*8,1.5,z-19);const orb=put(new THREE.IcosahedronGeometry(.25),material('#b0daf2',{emissive:'#397999',emissiveIntensity:1}),side*8,3,z-19);}}
 // A continuous trail connects all six regions; scenery stays out of it.
 box(7,.015,246,material('#776e5d'),0,.018,-1);
 for(let i=0;i<150;i++){const x=(rand()-.5)*124,z=(rand()-.5)*246;if(Math.abs(x)<10||Math.abs(z-120)<9)continue;const r=.7+rand()*1.6;if(i%3===0){put(new THREE.CylinderGeometry(.12,.4,5,7),wood,x,2.5,z);for(let k=0;k<3;k++)put(new THREE.ConeGeometry(1.7-k*.3,3.2,6),leaf,x,4+k*1.1,z);obstacles.push({x,z,w:1,d:1});}else{const rock=put(new THREE.DodecahedronGeometry(r),stone,x,r*.4,z);rock.scale.y=.5+rand()*.6;obstacles.push({x,z,w:r*1.6,d:r*1.6});}}
 for(let region=2;region<6;region++)for(const side of [-1,1]){const x=side*18,z=100-region*40;box(2,5+region,2,stone,x,(5+region)/2,z);box(2.7,.4,2.7,gold,x,5+region,z);if(region===4)for(let j=0;j<6;j++){const grave=box(.6,1.3,.3,stone,side*(12+j*4),.65,z+9);grave.rotation.z=(rand()-.5)*.2;}}
 // Return gate in the safe arrival camp.
 for(const x of [-3,3]){box(.8,4,.8,stone,x,2,122);put(new THREE.ConeGeometry(.8,1.5,4),gold,x,4.5,122);}box(7,.6,1,stone,0,4.2,122);
 const gate=put(new THREE.PlaneGeometry(4.8,3.7),new THREE.MeshBasicMaterial({color:'#77cfe1',transparent:true,opacity:.3,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}),0,1.9,122);
 root.updateMatrixWorld(true);const batches=new Map(),old=[];root.traverse(o=>{if(!o.isMesh||o===ground||o===gate)return;const key=o.material.uuid;if(!batches.has(key))batches.set(key,{m:o.material,g:[]});const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);batches.get(key).g.push(g);old.push(o);});for(const o of old)o.removeFromParent();for(const b of batches.values()){const merged=mergeGeometries(b.g);if(merged){const o=new THREE.Mesh(merged,b.m);o.castShadow=true;o.receiveShadow=true;root.add(o);}b.g.forEach(g=>g.dispose());}
 const navigation=createNavigation(obstacles,{minX:-61,maxX:61,minZ:-125,maxZ:127});
 const spawns=[];for(let layer=0;layer<6;layer++)for(let n=0;n<12;n++){const side=n%2?1:-1,x=side*(12+(n%6)*7),z=109-layer*40-Math.floor(n/2)*4;let point={x,z};if(navigation.blocked(x,z))point={x:side*8,z};if(navigation.blocked(point.x,point.z))point={x:0,z};if(layer===0&&n<2)point={x:n===0?-7:8,z:108};for(let attempt=0;attempt<40&&(navigation.blocked(point.x,point.z)||spawns.some(s=>Math.hypot(s.x-point.x,s.z-point.z)<2));attempt++)point={x:side*(6+attempt%10*2),z:z+Math.floor(attempt/10)*2};spawns.push({layer,x:point.x,z:point.z,rank:n%5});}
 const materials=new Set();root.traverse(o=>{if(o.isMesh&&o.material.color){materials.add(o.material);o.material.userData.baseColor=o.material.color.clone();}});
 return {setTheme(second){for(const m of materials)m.color.copy(m.userData.baseColor).lerp(new THREE.Color('#385c48'),second?.3:0);},root,ground,navigation,spawn:new THREE.Vector3(0,0,114),portalPosition:new THREE.Vector3(0,0,122),spawns,layers,update(time){gate.material.opacity=.3+Math.sin(time*2)*.08;},layerAt};
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
