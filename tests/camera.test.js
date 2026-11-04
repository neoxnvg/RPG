import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createClassicCamera,updateClassicCamera} from '../src/camera.js';
test('isometric camera follows immediately without changing angle or object size',()=>{const c=createClassicCamera(),point=new THREE.Vector3(0,0,0);updateClassicCamera(c,point);const offset=c.position.clone(),rotation=c.quaternion.clone(),span=c.top-c.bottom;point.set(8,0,-10);updateClassicCamera(c,point);assert.ok(c.position.clone().sub(point).distanceTo(offset)<1e-8);assert.ok(c.quaternion.angleTo(rotation)<1e-7);assert.equal(c.top-c.bottom,span);assert.ok(c.isOrthographicCamera);});
