import * as THREE from 'three';
export function createAtmosphere(scene){
 const root=new THREE.Group();root.name='Vespera viva';scene.add(root);const animated=[],citizens=[];
 const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.8});const stone=mat('#74767a'),wood=mat('#4b3328');
 function mesh(g,m,x,y,z,p=root){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
 const box=(w,h,d,m,x,y,z,p)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,p);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'#fff9df');gradient.addColorStop(.2,'#ffd284');gradient.addColorStop(.55,'#e86c2222');gradient.addColorStop(1,'#ff660000');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const flare=new THREE.CanvasTexture(canvas);
 for(const [x,z] of [[-10,-13],[10,-13],[-10,13],[10,13],[-6,40],[6,40]]){const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:flare,color:'#ffb765',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));glow.position.set(x,2,z);glow.scale.set(2,3,1);root.add(glow);const light=new THREE.PointLight('#ffad55',9,12);light.position.set(x,2.2,z);root.add(light);animated.push({glow,light,phase:x+z});}
 // Fountain with ripples and rising/returning droplets in the main square.
 mesh(new THREE.CylinderGeometry(2.6,2.8,.5,32),stone,0,.25,0);mesh(new THREE.CylinderGeometry(2.35,2.35,.05,32),new THREE.MeshStandardMaterial({color:'#4a9cab',metalness:.6,roughness:.2,transparent:true,opacity:.8}),0,.53,0);mesh(new THREE.CylinderGeometry(.4,.7,1.3,12),stone,0,1.1,0);mesh(new THREE.SphereGeometry(.45,12,10),new THREE.MeshStandardMaterial({color:'#9deafa',emissive:'#2685b3',emissiveIntensity:.7}),0,1.95,0);
 const waterGeo=new THREE.BufferGeometry(),water=new Float32Array(90*3);waterGeo.setAttribute('position',new THREE.BufferAttribute(water,3));const spray=new THREE.Points(waterGeo,new THREE.PointsMaterial({color:'#adefff',size:.065,transparent:true,opacity:.7}));root.add(spray);
 // Simple city inhabitants walk along unobstructed streets.
 for(let i=0;i<6;i++){const person=new THREE.Group();root.add(person);const cloth=mat(['#725a49','#4b6070','#76617b','#7b6845','#4b6c5c','#70484a'][i]);mesh(new THREE.CapsuleGeometry(.22,.6,4,8),cloth,0,1.05,0,person);mesh(new THREE.SphereGeometry(.2,8,6),mat('#ba967b'),0,1.75,0,person);mesh(new THREE.SphereGeometry(.21,8,6,0,Math.PI*2,0,Math.PI/2),wood,0,1.8,0,person);const legs=[];for(const side of [-1,1])legs.push(box(.14,.65,.17,wood,side*.15,.35,0,person));citizens.push({person,legs,lane:i%2?12:-12,phase:i*1.8});}
 for(const side of [-1,1])for(const z of [-10,10,29]){box(2,.15,.65,wood,side*15,.7,z);for(const x of [-.7,.7])box(.15,.7,.45,stone,side*15+x,.35,z);box(2,.5,.12,wood,side*15,1, z-.3);}
 const portalTextureCanvas=document.createElement('canvas');portalTextureCanvas.width=portalTextureCanvas.height=256;const pc=portalTextureCanvas.getContext('2d');for(let i=0;i<18;i++){pc.beginPath();pc.strokeStyle=`rgba(110,220,255,${.1+i/30})`;pc.lineWidth=1+i%3;pc.arc(128,128,10+i*5.5,i*.7,i*.7+Math.PI*1.4);pc.stroke();}const vortex=new THREE.Mesh(new THREE.PlaneGeometry(3.2,4.7),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(portalTextureCanvas),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));vortex.position.set(0,2.8,23.1);root.add(vortex);
 function update(time,dt){for(const {glow,light,phase} of animated){const f=1+Math.sin(time*9+phase)*.1;glow.scale.set(2*f,3*f,1);light.intensity=8+Math.sin(time*8+phase);}
 for(let i=0;i<90;i++){const t=(time*.5+i/90)%1,a=i*2.399;water[i*3]=Math.cos(a)*t*2;water[i*3+1]=.6+Math.sin(t*Math.PI)*1.3;water[i*3+2]=Math.sin(a)*t*2;}waterGeo.attributes.position.needsUpdate=true;
 for(const {person,legs,lane,phase} of citizens){const t=time*.12+phase;person.position.set(lane,0,Math.sin(t)*18);person.rotation.y=Math.cos(t)>0?0:Math.PI;legs.forEach((leg,i)=>leg.rotation.x=Math.sin(time*6+phase+i*Math.PI)*.4);}
 vortex.rotation.z=time*.35;
 }
 return {update,citizenCount:citizens.length};
}
