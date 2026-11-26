import {makeDetonationScene} from './spectacle.js?v=1';
const chapters=await fetch('chapters.json').then(r=>r.json());
window.startBlocksphere=async()=>{const e=window.PitchEngine;const scenes=chapters.map(c=>c.id==='detonation'?makeDetonationScene(c):e.scenes[c.id]);const d=await e.create({canvas:document.querySelector('#stage'),scenes,transitions:e.transitions,makeAudio:e.audio,qs:new URLSearchParams(location.search)});d.mute(true);const m=location.hash.match(/^#([a-z]+)(?:-(\d+))?$/);const id=m&&scenes.some(s=>s.id===m[1])?m[1]:'office';await d.start(id,m?.[2]?Math.min(+m[2]-1,scenes.find(s=>s.id===id).beats.length-1):0);return d};
await import('./app.js?v=1');
