// Small grid navigator: buildings remain solid for click and keyboard movement.
export function createNavigation(obstacles, bounds={minX:-41,maxX:41,minZ:-43,maxZ:43}) {
  const step=1.5, padding=.65;
  const blocked=(x,z)=>x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ||obstacles.some(o=>x>o.x-o.w/2-padding&&x<o.x+o.w/2+padding&&z>o.z-o.d/2-padding&&z<o.z+o.d/2+padding);
  function clear(a,b){const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.4);for(let i=0;i<=n;i++){const t=n?i/n:0;if(blocked(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false;}return true;}
  function path(start,end){
    if(blocked(end.x,end.z))return null;
    if(clear(start,end))return [{x:end.x,z:end.z}];
    const cell=p=>[Math.round(p.x/step),Math.round(p.z/step)],key=(x,z)=>`${x},${z}`;
    const [sx,sz]=cell(start),[ex,ez]=cell(end),open=[{x:sx,z:sz,g:0,f:0}],best=new Map([[key(sx,sz),0]]),parents=new Map();
    for(let tries=0;open.length&&tries<20000;tries++){
      open.sort((a,b)=>b.f-a.f);const n=open.pop(),k=key(n.x,n.z);if(n.g>best.get(k))continue;
      if(n.x===ex&&n.z===ez){const result=[{x:end.x,z:end.z}];let current=k;while(parents.has(current)){const [x,z]=current.split(',').map(Number);result.unshift({x:x*step,z:z*step});current=parents.get(current);}if(!result.every((p,i)=>clear(i?result[i-1]:start,p)))return null;return result;}
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const x=n.x+dx,z=n.z+dz;if(!clear({x:n.x*step,z:n.z*step},{x:x*step,z:z*step}))continue;
        const g=n.g+Math.hypot(dx,dz),next=key(x,z);if(g>=(best.get(next)??Infinity))continue;best.set(next,g);parents.set(next,k);open.push({x,z,g,f:g+Math.hypot(x-ex,z-ez)});
      }
    }return null;
  }
  function approach(start,target,radius=2.2){const base=Math.atan2(start.z-target.z,start.x-target.x);for(const offset of [0,1,-1,2,-2,3,-3,4,-4,5,-5,6,-6,7,-7,8]){const a=base+offset*Math.PI/8,point={x:target.x+Math.cos(a)*radius,z:target.z+Math.sin(a)*radius};if(path(start,point))return point;}return null;}
  return {blocked,clear,path,approach};
}
