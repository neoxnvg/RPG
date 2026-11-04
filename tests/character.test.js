import test from 'node:test';
import assert from 'node:assert/strict';
import {createHero,HEROES} from '../src/character.js';
test('all three equipped heroes animate and dispose; wings add real 3D geometry',()=>{for(const variant of Object.keys(HEROES)){const hero=createHero(variant),guard=createHero(variant,{wings:false});let heroMeshes=0,guardMeshes=0;hero.root.traverse(o=>{if(o.isMesh)heroMeshes++});guard.root.traverse(o=>{if(o.isMesh)guardMeshes++});assert.ok(heroMeshes>guardMeshes+80);hero.animate('Walking');hero.update(.1,1);hero.animate('Punch');hero.update(.1,2);assert.ok(hero.spec.weapon);hero.dispose();guard.dispose();}});
