import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const HEROES = {
 seraph: {name:'Arconte da Aurora',title:'GUARDIÃO CELESTIAL',rarity:'ASAS SERÁFICAS · EVOLUÇÃO IV',armor:'#243448',metal:'#e4bd6e',light:'#77e6ff',wing:'#c5dfeb',weapon:'Lâmina do Firmamento'},
 eclipse: {name:'Feiticeiro do Eclipse',title:'ARCANISTA ABISSAL',rarity:'ASAS DO VAZIO · EVOLUÇÃO IV',armor:'#282038',metal:'#b392da',light:'#c17aff',wing:'#75608e',weapon:'Cetro da Singularidade'},
 phoenix: {name:'Cavaleiro da Fênix',title:'SENHOR DAS BRASAS',rarity:'ASAS DA FÊNIX · EVOLUÇÃO IV',armor:'#39242d',metal:'#dc9b52',light:'#ff7b42',wing:'#c3553b',weapon:'Espada do Sol Partido'}
};

export function createHero(variant='seraph',{wings=true,helmet=true,armored=true,armed=true,weaponType=variant,armorTone=null,upgrade=0}={}) {
 const spec=HEROES[variant]??HEROES.seraph,root=new THREE.Group();root.name=spec.name;
 const metal=new THREE.MeshStandardMaterial({color:spec.metal,metalness:.82,roughness:.28});
 const armor=new THREE.MeshStandardMaterial({color:armorTone||spec.armor,metalness:.5,roughness:.5});
 const silver=new THREE.MeshStandardMaterial({color:'#9caabb',metalness:.85,roughness:.32});
 const leather=new THREE.MeshStandardMaterial({color:'#14171f',roughness:.8});
 const energy=new THREE.MeshStandardMaterial({color:spec.light,emissive:spec.light,emissiveIntensity:2.2,metalness:.35,roughness:.2});
 const plume=new THREE.MeshStandardMaterial({color:spec.wing,metalness:.5,roughness:.42,side:THREE.DoubleSide});
 function put(geo,mat,x,y,z,parent=root){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=false;m.receiveShadow=true;if(!armored&&parent.name==='cuirass'&&mat!==leather)m.visible=false;parent.add(m);return m;}
 const box=(w,h,d,m,x,y,z,p)=>put(new THREE.BoxGeometry(w,h,d),m,x,y,z,p);
 const sphere=(x,y,z,sx,sy,sz,m,p)=>{const o=put(new THREE.SphereGeometry(1,12,10),m,x,y,z,p);o.scale.set(sx,sy,sz);return o;};
 const spike=(x,y,z,r,h,m,p)=>put(new THREE.ConeGeometry(r,h,6),m,x,y,z,p);
 const joint=(x,y,z,p=root)=>{const g=new THREE.Group();g.position.set(x,y,z);p.add(g);return g;};
 const torso=joint(0,1.95,0);torso.name='cuirass';torso.scale.set(.88,1.06,.92);
 sphere(0,0,0,.48,.65,.28,leather,torso);
 // Overlapping cuirass plates, layered tassets and a luminous breastplate gem.
 const chestShape=new THREE.Shape();chestShape.moveTo(-.42,.43);chestShape.lineTo(.42,.43);chestShape.lineTo(.47,.12);chestShape.lineTo(.3,-.2);chestShape.lineTo(0,-.35);chestShape.lineTo(-.3,-.2);chestShape.lineTo(-.47,.12);chestShape.closePath();const chestGeometry=new THREE.ExtrudeGeometry(chestShape,{depth:.075,bevelEnabled:true,bevelThickness:.025,bevelSize:.035,bevelSegments:2});const chestBorder=put(chestGeometry,metal,0,.15,.15,torso);chestBorder.scale.set(1.07,1.07,1);put(chestGeometry,armor,0,.15,.19,torso);
 for(const side of [-1,1]){const trim=box(.48,.045,.05,metal,side*.23,.45,.31,torso);trim.rotation.z=side*-.22;
 for(let i=0;i<3;i++){const rib=box(.36-i*.035,.12,.1,i%2?armor:metal,side*.2,-.13-i*.14,.25,torso);rib.rotation.z=side*.16;}
 for(let i=0;i<3;i++){const skirt=box(.25,.38,.16,armor,side*(.17+i*.08),-.63-i*.03,.17-i*.12,torso);skirt.rotation.z=side*.15;box(.2,.03,.04,metal,skirt.position.x,skirt.position.y-.17,skirt.position.z+.1,torso);}}
 box(.8,.13,.47,metal,0,-.47,0,torso);sphere(0,.16,.36,.13,.19,.07,energy,torso);const crest=put(new THREE.OctahedronGeometry(.21),metal,0,.15,.29,torso);crest.scale.set(1,1.4,.3);
 for(let i=0;i<4;i++){const plate=box(.5-i*.04,.09,.06,silver,0,-.04-i*.12,.31,torso);plate.rotation.x=.12;}
 const head=joint(0,2.96,0);
 if(helmet){
 sphere(0,0,0,.29,.36,.27,armor,head);sphere(0,.17,-.07,.3,.2,.25,silver,head);
 box(.43,.052,.08,energy,0,.015,.25,head);box(.065,.47,.09,metal,0,.02,.27,head);
 for(const side of [-1,1]){const cheek=box(.1,.28,.14,metal,side*.22,-.12,.18,head);cheek.rotation.z=side*-.25;const horn=spike(side*.24,.4,-.05,.12,.65,metal,head);horn.rotation.z=side*-.45;}
 spike(0,.47,-.12,.12,.5,energy,head);
 }else{sphere(0,0,0,.22,.29,.23,new THREE.MeshStandardMaterial({color:'#c4a28c',roughness:.75}),head);sphere(0,.16,-.04,.24,.17,.23,leather,head);}

 const arms=[],legs=[];
 for(const side of [-1,1]){
  const arm=joint(side*.61,2.35,0);arms.push(arm);
  sphere(0,0,0,.29,.2,.3,armor,arm);
  for(let i=0;i<3;i++){const shoulder=box(.5-i*.06,.1,.5-i*.05,metal,side*i*.045,.16+i*.08,-i*.025,arm);shoulder.rotation.z=side*-.15;}
  for(let i=0;i<3;i++){const horn=spike(side*(.14+i*.1),.35+i*.035,-.08,.065,.35+i*.1,metal,arm);horn.rotation.z=side*-.5;}
  sphere(0,-.35,0,.17,.3,.17,leather,arm);sphere(0,-.62,0,.19,.17,.19,metal,arm);
  sphere(0,-.87,.04,.2,.27,.22,armor,arm);box(.1,.33,.05,energy,0,-.85,.25,arm);
  sphere(0,-1.13,.05,.17,.18,.19,metal,arm);
  const leg=joint(side*.22,1.3,0);leg.scale.y=1.25;legs.push(leg);
  sphere(0,-.15,0,.22,.35,.21,armor,leg);const knee=put(new THREE.OctahedronGeometry(.23),metal,0,-.45,.12,leg);knee.scale.set(1,1.1,.65);
  put(new THREE.CylinderGeometry(.17,.14,.54,6),armor,0,-.69,0,leg);box(.065,.32,.05,metal,0,-.69,.19,leg);
  sphere(0,-.95,.12,.22,.12,.35,armor,leg);box(.34,.04,.48,metal,0,-.97,.16,leg);
 }
 // Weapon attached to the right gauntlet, with an actual shaped blade.
 const weapon=joint(0,-1.12,.13,arms[1]);weapon.visible=armed;weapon.rotation.set(.25,0,-.6);
 if(weaponType==='eclipse'){
  box(.09,2.3,.09,metal,0,.45,0,weapon);const staffGem=put(new THREE.OctahedronGeometry(.25),energy,0,1.7,0,weapon);staffGem.scale.y=1.8;
  for(const side of [-1,1]){const prong=spike(side*.23,1.6,0,.09,.7,metal,weapon);prong.rotation.z=-side*.3;}
 }else{
  box(.1,.4,.11,leather,0,-.15,0,weapon);box(.65,.11,.16,metal,0,.1,0,weapon);
  const s=new THREE.Shape();s.moveTo(-.14,.15);s.lineTo(-.19,1.35);s.lineTo(0,2);s.lineTo(.19,1.35);s.lineTo(.14,.15);s.closePath();put(new THREE.ExtrudeGeometry(s,{depth:.065,bevelEnabled:true,bevelThickness:.015,bevelSize:.025,bevelSegments:1}),silver,0,0,0,weapon);
  box(.055,1.4,.025,energy,0,.85,.09,weapon);put(new THREE.OctahedronGeometry(.11),energy,0,-.37,0,weapon);
 }
 // Curved, layered feathers on four articulated celestial wings.
 const wingRoots=[];
 if(wings){const featherShape=new THREE.Shape();featherShape.moveTo(0,0);featherShape.quadraticCurveTo(-.18,.6,-.1,1.3);featherShape.quadraticCurveTo(.02,1.65,.07,1.85);featherShape.quadraticCurveTo(.25,.7,.14,.15);featherShape.closePath();
 const featherGeometry=new THREE.ExtrudeGeometry(featherShape,{depth:.035,bevelEnabled:false,curveSegments:8});
 for(const side of [-1,1])for(let tier=0;tier<2;tier++){
  const wing=joint(side*.32,2.45-tier*.42,-.28);wing.scale.setScalar(.82);wingRoots.push({wing,side,tier});
  for(let i=0;i<13;i++){const t=i/12,x=side*(.25+t*1.9),y=.12+Math.sin(t*Math.PI*.8)*1.1-tier*.7,z=-t*.24;
   const feather=put(featherGeometry,i%4===0?metal:plume,x,y,z,wing);feather.rotation.z=side*(-.65-t*.8);feather.scale.set(side*(tier?.8:1), (1.15-t*.3)*(tier?.65:1),1);
   const quill=box(.022,(1.45-t*.35)*(tier?.65:1),.045,energy,x+side*.18,y+.3,z+.05,wing);quill.rotation.z=side*(-.65-t*.8);}
  const cap=sphere(side*.55,.45,-.02,.65,.2,.18,armor,wing);cap.rotation.z=side*.5;
 }
 const halo=put(new THREE.TorusGeometry(.49,.018,6,48),energy,0,3.66,-.08);halo.rotation.x=Math.PI/2;
 }
 // Mantle strips remain behind the armor, clear of the weapon.
 for(const side of [-1,1]){const cape=box(.35,1.2,.05,leather,side*.27,1.15,-.34);cape.rotation.x=.14;box(.03,1.15,.06,metal,side*.43,1.15,-.38);}
 const footShadow=put(new THREE.CircleGeometry(.48,24),new THREE.MeshBasicMaterial({color:'#000000',transparent:true,opacity:.22,depthWrite:false}),0,.012,0);footShadow.rotation.x=-Math.PI/2;
 const aura=put(new THREE.TorusGeometry(.68,.018,5,48),energy,0,.04,0);aura.rotation.x=Math.PI/2;
 // Batch each articulated part separately, preserving animation pivots.
 const batches=new Map(),oldGeometry=new Set();
 root.traverse(o=>{if(!o.isMesh||o===aura||o===footShadow||!o.visible)return;o.updateMatrix();const key=o.parent.uuid+o.material.uuid;if(!batches.has(key))batches.set(key,{parent:o.parent,material:o.material,geometry:[],objects:[]});const batch=batches.get(key),g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);batch.geometry.push(g);batch.objects.push(o);oldGeometry.add(o.geometry);});
 for(const b of batches.values()){const geometry=mergeGeometries(b.geometry);if(geometry){const merged=new THREE.Mesh(geometry,b.material);merged.castShadow=false;merged.receiveShadow=true;b.parent.add(merged);for(const o of b.objects)o.removeFromParent();}for(const g of b.geometry)g.dispose();}
 const retained=new Set();root.traverse(o=>{if(o.isMesh)retained.add(o.geometry);});for(const g of oldGeometry)if(!retained.has(g))g.dispose();
 root.scale.setScalar(1.05);
 let action='Idle',phase=0,attackTime=0;
 function animate(name){action=name;if(name==='Punch')attackTime=.5;}
 function update(dt,time){phase+=dt*(action==='Running'?11:7);attackTime=Math.max(0,attackTime-dt);const walk=action==='Walking'||action==='Running';
  legs.forEach((leg,i)=>leg.rotation.x=walk?Math.sin(phase+i*Math.PI)*.45:0);
  arms.forEach((arm,i)=>{arm.rotation.x=attackTime>0&&i===1?-.9-Math.sin(attackTime*9)*.7:walk?-Math.sin(phase+i*Math.PI)*.25:-.1;arm.rotation.z=(i?1:-1)*.08;});
  torso.position.y=1.95+(walk?Math.abs(Math.sin(phase))*.045:Math.sin(time*1.8)*.018);head.rotation.y=Math.sin(time*.6)*.035;
  for(const {wing,side,tier} of wingRoots){wing.rotation.y=side*(.12+Math.sin(time*1.8-tier*.6)*.1);wing.rotation.z=side*Math.sin(time*1.4)*.035;}
  aura.rotation.z=time*.3;energy.emissiveIntensity=1.6+upgrade*.15+Math.sin(time*2)*.3;
 }
 function dispose(){const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}
 return {root,spec,variant,animate,update,dispose};
}
