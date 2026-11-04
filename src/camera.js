import * as THREE from 'three';
export const CLASSIC_CAMERA={yaw:Math.PI/4,pitch:Math.PI*.3,span:20};
export function createClassicCamera(){const camera=new THREE.OrthographicCamera(-15,15,10,-10,.1,220);camera.name='Classic isometric';return camera;}
export function updateClassicCamera(camera,target,{yaw=CLASSIC_CAMERA.yaw,pitch=CLASSIC_CAMERA.pitch,span=20,aspect=1.5}={}){
 camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();
 camera.position.copy(target).add(new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch)*60,Math.sin(pitch)*60,Math.cos(yaw)*Math.cos(pitch)*60));camera.lookAt(target.x,target.y+1.3,target.z);camera.updateMatrixWorld();
}
