import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createClassicCamera,updateClassicCamera,CLASSIC_CAMERA } from './camera.js';
import './style.css';
import { createAtmosphere } from './atmosphere.js';
import { createCity } from './city.js';
import { createHero,HEROES } from './character.js';
import { createSpellSystem,SPELLS } from './spells.js';
const $=s=>document.querySelector(s), canvas=$('#world');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true});}catch(e){$('#loading').textContent='Seu navegador precisa ter WebGL habilitado para jogar.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();scene.background=new THREE.Color('#343d49');scene.fog=new THREE.FogExp2('#343d49',.004);
const gameCamera=createClassicCamera(),portraitCamera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,220);let camera=gameCamera;
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.65;pmrem.dispose();
scene.add(new THREE.HemisphereLight('#c7d7ef','#342c24',1.7));const sun=new THREE.DirectionalLight('#ffe1ad',2.5);sun.position.set(-25,40,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-52,right:52,top:52,bottom:-52,far:160});sun.shadow.bias=-.001;scene.add(sun);
const mat=(c,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color:c,roughness,metalness});const stone=mat('#687875'),dark=mat('#3c5351'),gold=mat('#c6a666',.35,.65),grass=mat('#465f50');
function mesh(geo,material,x,y,z,parent=scene){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(w,h,d,m,x,y,z,p){return mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,p)}
function cyl(a,b,h,m,x,y,z,p){return mesh(new THREE.CylinderGeometry(a,b,h,12),m,x,y,z,p)}
let seed=42;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const city=createCity(scene);const atmosphere=createAtmosphere(scene);
const {ground,plaza:sanctuary,portal,portalMat,gate}=city;
const dustGeo=new THREE.BufferGeometry();const dust=new Float32Array(750);for(let i=0;i<750;i+=3){dust[i]=(rand()-.5)*70;dust[i+1]=rand()*10;dust[i+2]=(rand()-.5)*70;}dustGeo.setAttribute('position',new THREE.BufferAttribute(dust,3));const particles=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:'#e7d5a0',size:.065,transparent:true,opacity:.65}));scene.add(particles);
const player=new THREE.Group();player.position.copy(city.spawn);scene.add(player);
const heroKeyLight=new THREE.PointLight('#b4dcff',7,9);heroKeyLight.position.set(-2,4,3);player.add(heroKeyLight);const heroRimLight=new THREE.PointLight('#ffc580',4,8);heroRimLight.position.set(2,3,-2);player.add(heroRimLight);
let heroVariant='seraph';try{const savedHero=localStorage.getItem('aether-hero');if(HEROES[savedHero])heroVariant=savedHero;}catch{}
let hero=createHero(heroVariant);player.add(hero.root);
function animation(name){hero.animate(name);}
function selectHero(variant){if(!HEROES[variant])return;hero.dispose();hero=createHero(variant);player.add(hero.root);heroVariant=variant;try{localStorage.setItem('aether-hero',variant);}catch{}$('#hero-name').textContent=hero.spec.name;$('#hero-rarity').textContent=hero.spec.rarity;$('#hero-weapon').textContent=hero.spec.weapon;for(const button of document.querySelectorAll('[data-hero]'))button.classList.toggle('selected',button.dataset.hero===variant);}
const oracle=new THREE.Group();oracle.position.set(0,0,-17);scene.add(oracle);const orb=mesh(new THREE.IcosahedronGeometry(.55,2),new THREE.MeshStandardMaterial({color:'#9bf5e3',emissive:'#53daca',emissiveIntensity:2}),0,2,0,oracle);cyl(.7,1,.8,dark,0,.4,0,oracle);const ol=new THREE.PointLight('#61e6d4',14,8);ol.position.set(0,2,0);oracle.add(ol);
$('#loading').textContent='GUARDIÃO EQUIPADO · armadura, arma e asas evoluídas';

const shards=[];for(const [x,z] of [[-12,8],[12,-8],[-14,-18],[14,18],[0,-24]]){const g=new THREE.Group();g.position.set(x,1.4,z);scene.add(g);const gem=mesh(new THREE.OctahedronGeometry(.55),new THREE.MeshStandardMaterial({color:'#9cebd7',emissive:'#39c6ae',emissiveIntensity:1.5,metalness:.5,roughness:.2}),0,0,0,g);const ring=mesh(new THREE.TorusGeometry(.85,.025,5,40),gold,0,0,0,g);ring.rotation.x=Math.PI/2;shards.push({g,gem,collected:false});}
const enemies=[];for(const [x,z] of [[23,34],[29,34],[26,38]]){const enemyHero=createHero('phoenix',{wings:false});const g=enemyHero.root;g.scale.setScalar(.68);g.position.set(x,0,z);scene.add(g);enemies.push({g,visual:enemyHero,hp:60,maxHP:60,cool:0,origin:new THREE.Vector3(x,0,z)});}

let saved={};try{saved=JSON.parse(localStorage.getItem('aether-save')||'{}');}catch{}let count=0,kills=0,hp=100,quest=false,won=false,playing=false,paused=false,healCooldown=0,attackCooldown=0,yaw=CLASSIC_CAMERA.yaw,pitch=CLASSIC_CAMERA.pitch,zoom=CLASSIC_CAMERA.span,time=0,experience=0,goldCoins=0;
const cameraPan=new THREE.Vector3(),effects=[];experience=Number.isFinite(saved.experience)?saved.experience:0;goldCoins=Number.isFinite(saved.goldCoins)?saved.goldCoins:0;
if(Array.isArray(saved.collected)){saved.collected.forEach(i=>{if(shards[i]){shards[i].collected=true;shards[i].g.visible=false;count++;}});quest=!!saved.quest;won=!!saved.won;}
function save(){try{localStorage.setItem('aether-save',JSON.stringify({collected:shards.flatMap((s,i)=>s.collected?[i]:[]),quest,won,experience,goldCoins}));}catch{}}
function ui(){const level=1+Math.floor(experience/100);$('#level').textContent=`NV. ${level}`;$('#health').style.width=hp+'%';$('#orb-hp').textContent=Math.ceil(hp);$('#stats').textContent=`${Math.ceil(hp)} / 100 · VITALIDADE`;$('#wealth').textContent=`${goldCoins} ZEN · ${experience%100}/100 EXP`;$('#count').textContent=`${count} / 5 FRAGMENTOS`;$('#progress').style.width=count*20+'%';$('#objective').textContent=won?'✦ Portal de Vespera restaurado':!quest?'◇ Fale com a Capitã Lyra na praça principal':count<5?'◇ Explore Vespera e reúna os fragmentos':'◇ Volte ao portal e pressione E';}ui();
let toastTimer;function toast(t){$('#toast').textContent=t;$('#toast').style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.opacity=0,3500);}
function showDialogue(name,text){$('#dialog small').textContent=name;$('#dialog h2').textContent=name.split(' · ')[0];$('#speech').textContent=text;$('#dialog').hidden=false;paused=true;moveTarget=null;route=[];destination.visible=false;}
function interact(){if(!playing||paused)return;
const npc=city.npcs.find(n=>player.position.distanceTo(n.g.position)<3.4);
if(npc){const lines={
'Capitã Lyra':'Bem-vindo a Vespera, guardião. Esta cidade é um refúgio. Encontre os cinco fragmentos pelas ruas e leve-os ao portal da avenida. Conheça Mira no mercado, Brann na forja e Elara junto à catedral.',
'Mira':'Bem-vindo ao Mercado das Lanternas! Durante os testes, minhas provisões restauram sua vitalidade gratuitamente. Visite a forja ao sul para conhecer Brann.',
'Brann':'Sua arma está pronta. Na arena, segure o botão direito sobre um simulacro e use as teclas 1, 2 e 3 para combinar magias. Cada vitória concede experiência e Zen.',
'Irmã Elara':'A Aurora cuida dos viajantes. Sua vitalidade foi restaurada. O Oráculo aguarda na escadaria da catedral, ao norte da praça.',
'Mestre Oren':'A arena é uma simulação de combate. Os adversários reagem ao entrar no pátio e concedem experiência e Zen. Segure o botão direito para atacar. Fora da arena você está seguro.'};
if(npc.name==='Capitã Lyra'){quest=true;save();}if(['Mira','Irmã Elara'].includes(npc.name))hp=100;ui();showDialogue(`${npc.name} · ${npc.role}`,lines[npc.name]);return;}
if(player.position.distanceTo(oracle.position)<4){quest=true;save();hp=100;ui();showDialogue('Oráculo · Memória de Vespera',count<5?'Os cinco fragmentos estão espalhados nas vias da cidade. As luzes verdes indicarão seu caminho. Traga todos ao portal na avenida sul.':'Os fragmentos estão reunidos. Retorne ao portal da avenida sul e pressione E para restaurá-lo.');return;}
if(player.position.distanceTo(city.portalPosition)<4){if(count===5){won=true;quest=true;portalMat.opacity=.8;save();ui();toast('✦ PORTAL RESTAURADO · Vespera recebe seu guardião!');}else toast('O portal precisa de cinco fragmentos de luz.');return;}toast('Aproxime-se de um NPC ou clique nele para conversar.');}

const pulse=mesh(new THREE.TorusGeometry(1,.08,8,50),new THREE.MeshBasicMaterial({color:'#e9d3a0',transparent:true,opacity:0}),0,1,0);pulse.rotation.x=Math.PI/2;let pulseLife=0;
function impact(enemy,damage=10){
const center=enemy.g.position.clone().add(new THREE.Vector3(0,1.2,0));
const start=player.position.clone().add(new THREE.Vector3(0,1.3,0)),delta=center.clone().sub(start);
const beam=mesh(new THREE.CylinderGeometry(.045,.09,delta.length(),8),new THREE.MeshBasicMaterial({color:'#b9ffe9',transparent:true,opacity:.95}),0,0,0);beam.position.copy(start).addScaledVector(delta,.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());effects.push({object:beam,life:.25,max:.25});
for(let i=0;i<12;i++){const spark=mesh(new THREE.SphereGeometry(.07,6,4),new THREE.MeshBasicMaterial({color:i%2?'#ffe2a2':'#aaffec',transparent:true}),...center.toArray());effects.push({object:spark,velocity:new THREE.Vector3((Math.random()-.5)*7,Math.random()*5,(Math.random()-.5)*7),life:.5,max:.5});}
const flash=mesh(new THREE.SphereGeometry(.85,14,10),new THREE.MeshBasicMaterial({color:'#fff0bc',transparent:true,opacity:.65,wireframe:true}),...center.toArray());effects.push({object:flash,life:.3,max:.3});
const label=document.createElement('span');label.className='damage-number';label.textContent=`−${damage}`;document.body.append(label);effects.push({label,position:center.clone(),life:.9,max:.9});
}
function attack(target=null){if(!playing||paused||attackCooldown>0)return;if(target&&target.g.position.distanceTo(player.position)>35){toast('Inimigo longe demais. Aproxime-se para atacar.');return;}attackCooldown=.6;pulseLife=.4;pulse.position.copy(player.position);pulse.position.y=player.position.y+1;animation('Punch');
const victims=target?[target]:enemies.filter(e=>e.g.position.distanceTo(player.position)<3.5);
for(const e of victims){if(e.hp<=0)continue;if(target){const facing=e.g.position.clone().sub(player.position);player.rotation.y=Math.atan2(facing.x,facing.z);}hurtEnemy(e,10);}
}
function hurtEnemy(e,damage){if(e.hp<=0)return;e.hp=Math.max(0,e.hp-damage);impact(e,damage);if(e.hp===0){e.g.visible=false;e.cool=0;kills++;const previousLevel=Math.floor(experience/100);experience+=25;goldCoins+=10;hp=Math.min(100,hp+10);if(Math.floor(experience/100)>previousLevel){hp=100;toast('✦ NÍVEL AUMENTADO · Vitalidade restaurada');}else toast('+25 EXP · +10 ZEN · Simulacro derrotado');save();ui();}}

const magic=createSpellSystem({scene,player,enemies,onDamage:hurtEnemy,toast});
function castSpell(id){if(!playing||paused)return;if(magic.cast(id))animation('Punch');}


function heal(){if(!playing||paused)return;if(healCooldown>0){toast(`Restauração recarregando: ${Math.ceil(healCooldown)}s`);return;}hp=Math.min(100,hp+40);healCooldown=15;magic.restore();ui();toast('✧ Luz restauradora · +40 vitalidade');}
const keys=new Set();addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.key.toLowerCase());if(e.repeat)return;if(e.code==='Space')attack();if(e.key.toLowerCase()==='e')interact();if(e.key.toLowerCase()==='q')heal();if(e.key.toLowerCase()==='h')toggleHero();for(const [id,spell] of Object.entries(SPELLS))if(e.key===spell.key)castSpell(id);if(e.key.toLowerCase()==='r'){cameraPan.set(0,0,0);yaw=CLASSIC_CAMERA.yaw;pitch=CLASSIC_CAMERA.pitch;zoom=CLASSIC_CAMERA.span;}if(e.key.toLowerCase()==='c'&&!portrait)yaw+=Math.PI/4;if(e.key.toLowerCase()==='m')overview();if(e.code==='Escape'){if(portrait)toggleHero();else pause();}});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{keys.clear();attackHeld=false;if(playing&&!paused)pause();});
function overview(){if(!playing)return;cameraPan.set(-player.position.x,0,-player.position.z);zoom=110;pitch=1;yaw=0;toast('Vista da cidade · R para voltar ao personagem');}
$('#map').onclick=overview;
let portrait=false,portraitWasPaused=false,savedCamera=null;
function toggleHero(){if(!playing)return;portrait=!portrait;$('#hero-panel').hidden=!portrait;if(portrait){portraitWasPaused=paused;paused=true;camera=portraitCamera;savedCamera={yaw,pitch,zoom,pan:cameraPan.clone()};cameraPan.set(0,0,0);yaw=.25;pitch=.24;zoom=10;player.rotation.y=0;animation('Idle');keys.clear();camera.position.copy(player.position).add(new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch)*zoom,Math.sin(pitch)*zoom,Math.cos(yaw)*Math.cos(pitch)*zoom));camera.lookAt(player.position.x,player.position.y+2.1,player.position.z);}else{paused=portraitWasPaused;camera=gameCamera;if(savedCamera){({yaw,pitch,zoom}=savedCamera);cameraPan.copy(savedCamera.pan);}}}
$('#equipment').onclick=toggleHero;$('#hero-close').onclick=toggleHero;
for(const button of document.querySelectorAll('[data-hero]'))button.onclick=()=>selectHero(button.dataset.hero);
for(const button of document.querySelectorAll('[data-spell]'))button.onclick=()=>castSpell(button.dataset.spell);
selectHero(heroVariant);
$('#play').onclick=()=>{playing=true;$('#intro').hidden=true;cameraPan.set(0,0,0);toast('Clique para andar · Segure o botão direito no alvo para atacar · C gira a visão');};function pause(){if(!playing)return;paused=!paused;$('#pause').textContent=paused?'▶ CONTINUAR':'Ⅱ PAUSAR';keys.clear();}$('#pause').onclick=()=>{if(portrait)toggleHero();else pause();};$('#close').onclick=()=>{$('#dialog').hidden=true;paused=false;};$('#attack').onclick=()=>attack();$('#heal').onclick=heal;$('#interact').onclick=interact;
for(const b of document.querySelectorAll('[data-key]')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.key);}
let moveTarget=null,route=[],pendingNpc=null,selectedEnemy=null,attackHeld=false;
function travelTo(point){const path=city.navigation.path(player.position,point);if(!path){toast('Essa área não é acessível. Clique em uma rua ou praça.');return false;}route=path;const first=route.shift();moveTarget=new THREE.Vector3(first.x,0,first.z);destination.position.set(point.x,.07,point.z);destination.visible=true;return true;}

const targetRing=mesh(new THREE.TorusGeometry(.9,.065,6,48),new THREE.MeshBasicMaterial({color:'#f86b55',transparent:true,opacity:.85}),0,.1,0);targetRing.rotation.x=Math.PI/2;targetRing.visible=false;
const destination=mesh(new THREE.RingGeometry(.35,.46,40),new THREE.MeshBasicMaterial({color:'#a8f3dd',side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false}),0,.04,0);destination.rotation.x=-Math.PI/2;destination.visible=false;
for(const npc of city.npcs){const label=document.createElement('button');label.className='npc-label';label.innerHTML=`<strong>${npc.name}</strong><small>${npc.role}</small>`;label.hidden=true;label.onclick=()=>{if(!playing||paused)return;if(player.position.distanceTo(npc.g.position)<3.2){interact();return;}const point=npc.g.position.clone(),approach=player.position.clone().sub(point).setY(0).normalize();point.addScaledVector(approach,2);if(travelTo(point))pendingNpc=npc;};document.body.append(label);npc.label=label;}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
let dragging=false,dragged=false,lastX,lastY,startX,startY,activePointer=null,panDrag=false;
function aimAt(e){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);}
canvas.addEventListener('contextmenu',e=>{e.preventDefault();});
canvas.addEventListener('pointerdown',e=>{
if(e.button===2){e.preventDefault();if(!playing||paused)return;aimAt(e);const alive=enemies.filter(enemy=>enemy.hp>0);const hit=raycaster.intersectObjects(alive.map(enemy=>enemy.g),true)[0];const enemy=hit&&alive.find(enemy=>{let node=hit.object;while(node){if(node===enemy.g)return true;node=node.parent;}return false;});if(enemy){selectedEnemy=enemy;attackHeld=true;moveTarget=null;route=[];pendingNpc=null;destination.visible=false;attack(enemy);}return;}
if((e.button!==0&&e.button!==1)||activePointer!==null)return;e.preventDefault();dragging=true;dragged=false;panDrag=e.button===1;activePointer=e.pointerId;startX=lastX=e.clientX;startY=lastY=e.clientY;canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==activePointer)return;if(Math.hypot(e.clientX-startX,e.clientY-startY)>6)dragged=true;if(dragged&&portrait){yaw-=(e.clientX-lastX)*.006;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastY)*.005,.12,1.4);}lastX=e.clientX;lastY=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(e.button===2){attackHeld=false;return;}if(e.pointerId!==activePointer)return;dragging=false;activePointer=null;if(panDrag||(dragged&&portrait)||!playing||paused)return;aimAt(e);
const npcHits=raycaster.intersectObjects(city.npcs.map(n=>n.g),true);if(npcHits.length){const npc=city.npcs.find(n=>{let o=npcHits[0].object;while(o){if(o===n.g)return true;o=o.parent;}return false;});if(npc){const point=npc.g.position.clone();const approach=player.position.clone().sub(point);approach.y=0;if(approach.length()<3.2){interact();return;}point.addScaledVector(approach.normalize(),2);if(travelTo(point))pendingNpc=npc;return;}}
const hit=raycaster.intersectObjects([ground],false)[0];if(!hit)return;pendingNpc=null;travelTo(hit.point);});

addEventListener('pointerup',e=>{if(e.button===2)attackHeld=false;});
canvas.addEventListener('pointercancel',()=>{attackHeld=false;dragging=false;activePointer=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom*Math.exp(e.deltaY*.001),portrait?6:14,portrait?14:32);},{passive:false});

function resize(){portraitCamera.aspect=innerWidth/innerHeight;portraitCamera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}addEventListener('resize',resize);resize();const clock=new THREE.Clock();
function tick(){requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.1);time+=dt;city.update(time);atmosphere.update(time,dt);hero.update(dt,time);magic.update(dt,playing&&!paused);const magicState=magic.state;$('#mana').style.width=magicState.mana+'%';$('#orb-mana').textContent=Math.floor(magicState.mana);$('#mana-value').textContent=Math.floor(magicState.mana)+' / 100 MANA';for(const button of document.querySelectorAll('[data-spell]')){const cd=magicState.cooldowns[button.dataset.spell];button.querySelector('.cooldown').textContent=cd>0?Math.ceil(cd)+'s':'';button.classList.toggle('recharging',cd>0);button.disabled=!playing||paused||cd>0;}orb.position.y=2+Math.sin(time)*.2;particles.rotation.y=time*.007;gate.material.emissiveIntensity=1.8+Math.sin(time*2)*.4;if(won)portalMat.opacity=.8;
for(const s of shards){s.g.rotation.y+=dt;s.g.position.y=1.5+Math.sin(time*2+s.g.position.x)*.2;}
if(playing&&!paused){if(attackHeld&&selectedEnemy?.hp>0)attack(selectedEnemy);healCooldown=Math.max(0,healCooldown-dt);attackCooldown=Math.max(0,attackCooldown-dt);const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));const dir=new THREE.Vector3();if(keys.has('w')||keys.has('arrowup'))dir.add(forward);if(keys.has('s')||keys.has('arrowdown'))dir.sub(forward);if(keys.has('d')||keys.has('arrowright'))dir.add(right);if(keys.has('a')||keys.has('arrowleft'))dir.sub(right);let step=dt*(keys.has('shift')?9:6.5);if(dir.lengthSq()){moveTarget=null;route=[];pendingNpc=null;destination.visible=false;}else if(moveTarget){dir.copy(moveTarget).sub(player.position);dir.y=0;const distance=dir.length();if(distance<.12){if(route.length){const next=route.shift();moveTarget.set(next.x,0,next.z);}else{moveTarget=null;destination.visible=false;if(pendingNpc){pendingNpc=null;interact();}}dir.set(0,0,0);}else step=Math.min(step,distance);}if(dir.lengthSq()){dir.normalize();const next=player.position.clone().addScaledVector(dir,step);if(!city.navigation.blocked(next.x,next.z))player.position.copy(next);player.rotation.y=Math.atan2(dir.x,dir.z);if(attackCooldown<.25)animation(keys.has('shift')?'Running':'Walking');}else if(attackCooldown<.25)animation('Idle');
player.position.y=0;
for(const s of shards){if(!s.collected&&player.position.distanceTo(s.g.position)<2){s.collected=true;s.g.visible=false;count++;save();ui();toast(count===5?'✧ Todos os fragmentos reunidos · Retorne ao portal!':`✧ Fragmento de luz encontrado · ${count}/5`);}}
const inArena=player.position.x>14&&player.position.z>29;
for(const e of enemies){e.visual.update(dt,time);if(e.hp<=0){e.cool+=dt;if(e.cool>8){e.hp=e.maxHP;e.cool=0;e.g.visible=true;e.g.position.copy(e.origin);}continue;}
e.cool=Math.max(0,e.cool-dt);const distance=e.g.position.distanceTo(player.position);
if(inArena&&distance<12){const dir=player.position.clone().sub(e.g.position);dir.y=0;e.g.rotation.y=Math.atan2(dir.x,dir.z);if(distance>2){e.g.position.addScaledVector(dir.normalize(),dt*1.9);e.visual.animate('Walking');}else{e.visual.animate('Idle');if(e.cool===0){hp=Math.max(0,hp-8);e.cool=1.3;e.visual.animate('Punch');ui();if(hp===0){hp=100;player.position.copy(city.spawn);moveTarget=null;route=[];selectedEnemy=null;attackHeld=false;destination.visible=false;for(const enemy of enemies)enemy.g.position.copy(enemy.origin);toast('Você foi resgatado para o portão de Vespera.');ui();}}}}
else{const back=e.origin.clone().sub(e.g.position);if(back.length()>.2){e.g.position.addScaledVector(back.normalize(),dt*2);e.visual.animate('Walking');}else e.visual.animate('Idle');}}


}
if(pulseLife>0){pulseLife-=dt;const scale=1+(.4-pulseLife)*7;pulse.scale.setScalar(scale);pulse.material.opacity=Math.max(0,pulseLife*2);}else pulse.material.opacity=0;
const target=(playing?player.position.clone():new THREE.Vector3(0,1,0)).add(cameraPan);
if(portrait){const offset=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch)*zoom,Math.sin(pitch)*zoom,Math.cos(yaw)*Math.cos(pitch)*zoom);camera.position.copy(target).add(offset);camera.lookAt(target.x,target.y+2.1,target.z);camera.updateMatrixWorld();}else updateClassicCamera(gameCamera,target,{yaw:playing?yaw:0,pitch:playing?pitch:1,span:playing?zoom:112,aspect:innerWidth/innerHeight});
for(let i=effects.length-1;i>=0;i--){const effect=effects[i];effect.life-=dt;if(effect.life<=0){if(effect.object){scene.remove(effect.object);effect.object.geometry.dispose();effect.object.material.dispose();}effect.label?.remove();effects.splice(i,1);continue;}if(effect.object){effect.object.material.opacity=effect.life/effect.max;if(effect.velocity)effect.object.position.addScaledVector(effect.velocity,dt);}if(effect.label){const pos=effect.position.clone();pos.y+=(1-effect.life/effect.max)*1.8;pos.project(camera);effect.label.style.left=(pos.x*.5+.5)*innerWidth+'px';effect.label.style.top=(-pos.y*.5+.5)*innerHeight+'px';effect.label.style.opacity=effect.life/effect.max;effect.label.hidden=pos.z>1;}}
targetRing.visible=!!selectedEnemy&&selectedEnemy.hp>0;if(selectedEnemy){targetRing.position.copy(selectedEnemy.g.position);targetRing.position.y=.08;}
const targetPanel=$('#target-panel');targetPanel.hidden=!playing||!selectedEnemy||selectedEnemy.hp<=0;if(selectedEnemy){$('#target-health').style.width=selectedEnemy.hp/selectedEnemy.maxHP*100+'%';$('#target-value').textContent=`${selectedEnemy.hp} / ${selectedEnemy.maxHP}`;}
for(const npc of city.npcs){const p=npc.g.position.clone().add(new THREE.Vector3(0,2.8,0)).project(camera);npc.label.hidden=!playing||paused||npc.g.position.distanceTo(player.position)>24||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;npc.label.style.left=(p.x*.5+.5)*innerWidth+'px';npc.label.style.top=(-p.y*.5+.5)*innerHeight+'px';}
renderer.render(scene,camera);}
tick();
// Read-only telemetry for browser smoke checks and support.
window.aetherState = function(){return {playing,paused,hp,count,quest,won,yaw,pitch,zoom,cameraMode:portrait?"portrait":"isometric",citizenCount:atmosphere.citizenCount,city:"Vespera",buildings:city.buildings,npcs:city.npcs.map(n=>{const p=n.g.position.clone().add(new THREE.Vector3(0,1,0)).project(camera);return {name:n.name,role:n.role,position:n.g.position.toArray(),screen:[(p.x*.5+.5)*innerWidth,(-p.y*.5+.5)*innerHeight]};}),routeLength:route.length,cameraPan:cameraPan.toArray(),effects:effects.length,enemies:enemies.map(e=>{const p=e.g.position.clone().add(new THREE.Vector3(0,1.1,0)).project(camera);return {hp:e.hp,screen:[(p.x*.5+.5)*innerWidth,(-p.y*.5+.5)*innerHeight],visible:e.g.visible};}),experience,goldCoins,selectedEnemyHP:selectedEnemy?.hp??null,moveTarget:moveTarget?.toArray()??null,position:player.position.toArray(),modelLoaded:true,heroVariant,heroName:hero.spec.name,heroWings:true,portrait,magic:magic.state,enemyCount:enemies.filter(e=>e.hp>0).length};}
