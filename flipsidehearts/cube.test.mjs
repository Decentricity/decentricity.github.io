import assert from 'node:assert/strict';
import {foldSurface,HALF,dot} from './cube.js';
const normals=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const near=(a,b)=>a.every((n,i)=>Math.abs(n-b[i])<1e-9);
let crossings=0;
for(const normal of normals){
  const oldAxis=normal.findIndex(n=>n!==0);
  for(let axis=0;axis<3;axis++)if(axis!==oldAxis)for(const direction of [-1,1]){
    const start=normal.map(n=>n*HALF),heading=[0,0,0];heading[axis]=direction;
    start[axis]=direction*(HALF-.1);
    const outside=[...start];outside[axis]+=direction*.2;
    const result=foldSurface(outside,normal,heading);
    assert.equal(result.turns,1);assert.equal(result.normal[axis],direction);
    assert.equal(dot(result.normal,result.heading),0);
    assert.ok(result.position.every(n=>Math.abs(n)<=HALF+1e-9));
    const reverse=[...result.position];reverse[oldAxis]+=normal[oldAxis]*.2;
    const back=foldSurface(reverse,result.normal,result.heading);
    assert.ok(near(back.normal,normal));assert.ok(near(back.position,start));assert.ok(near(back.heading,heading));crossings++;
  }
}
// Repeated corner travel must stay on the surface and retain a tangent heading.
let normal=[0,1,0],heading=[Math.SQRT1_2,0,Math.SQRT1_2],position=[0,HALF,0];
for(let i=0;i<10000;i++){
  const result=foldSurface(position.map((v,j)=>v+heading[j]*.08),normal,heading);
  ({normal,heading,position}=result);
  assert.ok(position.every(v=>Math.abs(v)<=HALF+1e-7));
  assert.ok(Math.abs(dot(normal,heading))<1e-9);
  assert.ok(Math.abs(dot(normal,position)-HALF)<1e-7);
}
console.log(`Passed ${crossings} directed edge crossings, their reversals, and 10,000 corner-travel steps.`);
