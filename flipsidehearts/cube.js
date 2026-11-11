// Surface coordinates are world-space cube coordinates. Heading stays tangent.
export const HALF = 9;
export function dot(a,b){return a.reduce((s,v,i)=>s+v*b[i],0)}
export function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
export function rotateQuarter(v,axis){const c=cross(axis,v),d=dot(axis,v);return c.map((x,i)=>x+axis[i]*d)}
export function foldSurface(position,normal,heading,half=HALF){
  let p=[...position],n=[...normal],f=[...heading],turns=0;
  for(let pass=0;pass<4;pass++){
    const oldAxis=n.findIndex(v=>Math.abs(v)>.5);
    let axis=-1,excess=0;
    for(let i=0;i<3;i++)if(i!==oldAxis&&Math.abs(p[i])-half>excess){axis=i;excess=Math.abs(p[i])-half}
    if(axis<0)break;
    const next=[0,0,0];next[axis]=Math.sign(p[axis]);
    const rotationAxis=cross(n,next);
    p[oldAxis]=n[oldAxis]*(half-excess);p[axis]=next[axis]*half;
    f=rotateQuarter(f,rotationAxis);n=next;turns++;
  }
  return {position:p,normal:n,heading:f,turns};
}
export function faceId(n){return `${n.find(v=>v!==0)>0?'+':'-'}${'XYZ'[n.findIndex(v=>v!==0)]}`}
