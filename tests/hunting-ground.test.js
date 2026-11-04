import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHuntingGround} from '../src/hunting-ground.js';

function withField(run){
 const previous=globalThis.document;
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){}})})};
 try{return run(createHuntingGround(new THREE.Scene()));}
 finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
}

test('six territories have 18 named hotspots with four walkable, separated defenders each',()=>withField(field=>{
 assert.equal(field.spawns.length,72);
 assert.equal(field.hotspots.length,18);
 assert.equal(new Set(field.hotspots.map(h=>h.id)).size,18);
 assert.equal(new Set(field.hotspots.map(h=>h.name)).size,18);
 for(let layer=0;layer<6;layer++){
  assert.equal(field.spawns.filter(s=>s.layer===layer).length,12);
  assert.equal(field.hotspots.filter(h=>h.layer===layer).length,3);
 }
 for(const hotspot of field.hotspots){
  assert.equal(field.layerAt(hotspot.z),hotspot.layer);
  assert.equal(field.navigation.blocked(hotspot.x,hotspot.z),false);
  assert.equal(hotspot.levelMin,field.layers[hotspot.layer].min);
  assert.equal(hotspot.levelMax,field.layers[hotspot.layer].max);
  const defenders=field.spawns.filter(s=>s.hotspotId===hotspot.id);
  assert.equal(defenders.length,4);
  for(const defender of defenders){
   assert.equal(defender.layer,hotspot.layer);
   assert.equal(field.layerAt(defender.z),hotspot.layer);
   assert.ok(Math.hypot(defender.x-hotspot.x,defender.z-hotspot.z)<=hotspot.radius);
   assert.equal(field.navigation.blocked(defender.x,defender.z),false);
   assert.ok(field.navigation.clear(hotspot.center,defender),'each defender must be reachable inside its encounter');
  }
 }
 for(let i=0;i<field.spawns.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(field.spawns[i].x-field.spawns[j].x,field.spawns[i].z-field.spawns[j].z)>=2);
 assert.equal(field.navigation.blocked(62,0),true);
 assert.equal(field.navigation.blocked(0,128),true);
 assert.equal(field.navigation.blocked(field.spawn.x,field.spawn.z),false);
 const nearest=Math.min(...field.spawns.map(s=>Math.hypot(s.x-field.spawn.x,s.z-field.spawn.z)));
 assert.ok(nearest<11,'first encounter must be visible near the arrival camp');
}));

test('the trail connects every hotspot and both world gates without blocking the arrival',()=>withField(field=>{
 assert.ok(field.navigation.path(field.spawn,field.portalPosition));
 assert.ok(field.navigation.path(field.spawn,{x:0,z:-122}));
 for(const hotspot of field.hotspots){
  const path=field.navigation.path({x:0,z:hotspot.z},hotspot.center);
  assert.ok(path,`${hotspot.name} must be reachable from the central trail`);
  for(let i=0;i<path.length;i++)assert.ok(field.navigation.clear(i?path[i-1]:{x:0,z:hotspot.z},path[i]));
 }
}));

test('environment effects animate while themes can be restored without cumulative tint',()=>withField(field=>{
 const groundColor=field.ground.material.color.clone();
 const motes=field.root.getObjectByName('Faíscas dos territórios');
 assert.ok(motes?.isPoints);
 assert.equal(motes.geometry.attributes.position.count,480);
 field.update(12);
 assert.equal(motes.material.uniforms.time.value,12);
 field.setTheme(true);
 assert.ok(!field.ground.material.color.equals(groundColor));
 field.setTheme(false);
 assert.ok(field.ground.material.color.equals(groundColor));
 assert.ok(field.root.children.filter(o=>o.isMesh).length<300,'scenery should use a bounded number of spatial rendering batches');
}));


test('procedural PBR maps use the correct color space and detailed geometry remains finite',()=>withField(field=>{
 const materials=new Set(),surfaces=new Set();
 field.root.traverse(object=>{
  if(!object.geometry)return;
  for(const name of ['position','normal','windWeight']){const attribute=object.geometry.getAttribute(name);if(attribute)for(const value of attribute.array)assert.ok(Number.isFinite(value),`${name} contains invalid geometry`);}
  if(object.material)materials.add(object.material);
  if(object.userData.sceneryBatch){assert.ok(object.geometry.boundingSphere.radius<90,'spatial scenery batches must permit frustum culling');}
 });
 for(const material of materials){
  if(material.map?.name.startsWith('Vale/')){assert.equal(material.map.colorSpace,THREE.SRGBColorSpace);surfaces.add(material.map.name.split('/')[1]);}
  for(const key of ['normalMap','bumpMap','roughnessMap'])if(material[key])assert.equal(material[key].colorSpace,THREE.NoColorSpace,`${key} must be linear data`);
 }
 for(const surface of ['soil','paving','stone','bark','foliage'])assert.ok(surfaces.has(surface),`missing ${surface} surface`);
 const windMaterials=[...materials].filter(m=>m.userData.wind);
 assert.ok(windMaterials.length>=6);
 const shader={uniforms:{},vertexShader:'#include <begin_vertex>'};windMaterials[0].onBeforeCompile(shader);
 assert.match(shader.vertexShader,/attribute float windWeight;/);
 field.update(17);assert.equal(shader.uniforms.windTime.value,17);
 for(const mesh of field.root.children.filter(o=>o.material?.userData.wind))assert.ok(mesh.geometry.hasAttribute('windWeight'),'wind material needs an explicit vertex weight');
}));
