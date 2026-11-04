import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigation } from '../src/navigation.js';
test('click route goes around a solid building without cutting its corners',()=>{
 const nav=createNavigation([{x:-25,z:0,w:13,d:11}]);
 const start={x:-35,z:0},end={x:-15,z:0};
 const route=nav.path(start,end);assert.ok(route?.length>1);
 let previous=start;for(const point of route){assert.ok(nav.clear(previous,point));previous=point;}
 assert.deepEqual(route.at(-1),end);
});
test('building interiors and wall boundaries reject movement',()=>{
 const nav=createNavigation([{x:0,z:0,w:10,d:10}]);
 assert.equal(nav.path({x:0,z:10},{x:0,z:0}),null);
 assert.equal(nav.path({x:0,z:10},{x:44,z:10}),null);
 assert.equal(nav.blocked(4.9,0),true);
});
test('open roads use a direct route',()=>{
 const nav=createNavigation([]);const end={x:0,z:-20};
 assert.deepEqual(nav.path({x:0,z:35},end),[end]);
});
test('NPC approach finds an accessible side instead of a point inside the forge',()=>{const nav=createNavigation([{x:25,z:21,w:14,d:10}]);const start={x:20,z:2},npc={x:20,z:28},point=nav.approach(start,npc);assert.ok(point);assert.equal(nav.blocked(point.x,point.z),false);assert.ok(nav.path(start,point));assert.ok(Math.hypot(point.x-npc.x,point.z-npc.z)<3);});
