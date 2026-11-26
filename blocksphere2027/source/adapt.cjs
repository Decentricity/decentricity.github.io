// Deterministic adaptation of the downloaded Claude artifact, not a recreated engine.
const fs=require('fs'),path=require('path'),acorn=require('acorn'),crypto=require('crypto');
const root=__dirname,out=path.resolve(root,'..');
const zlib=require('zlib');
const readOriginal=name=>zlib.gunzipSync(fs.readFileSync(path.join(root,name+'.gz')));
const input=readOriginal('original-readable.js').toString('utf8');
const ast=acorn.parse(input,{ecmaVersion:'latest',locations:true});
const copy=JSON.parse(fs.readFileSync(path.join(root,'copy.json'))),chapters=JSON.parse(fs.readFileSync(path.join(out,'chapters.json')));
const literals=new Map(),edits=[];let chapterNo=0;
function walk(n){if(!n||typeof n!=='object')return;
 if(n.type==='Literal'&&typeof n.value==='string'||n.type==='TemplateLiteral'&&!n.expressions.length){if(!literals.has(n.loc.start.line)||[44054,44059,44061,44063,44149].includes(n.loc.start.line))literals.set(n.loc.start.line,n);}
 if(n.type==='ObjectExpression'){
  const id=n.properties.find(p=>p.key?.name==='id')?.value?.value;
  const chapter=chapters.find(c=>c.id===id);
  if(chapter&&n.properties.some(p=>p.key?.name==='beats')){
   chapterNo++;
   for(const key of ['title','notes']){const p=n.properties.find(p=>p.key?.name===key);edits.push({start:p.value.start,end:p.value.end,text:JSON.stringify(chapter[key])});}
   const beats=n.properties.find(p=>p.key?.name==='beats').value.elements;
   beats.forEach((b,i)=>{const p=b.properties.find(p=>p.key?.name==='page');edits.push({start:p.value.start,end:p.value.end,text:JSON.stringify(String(chapterNo).padStart(2,'0')+' / '+(i+1))});});
  }
 }
 for(const k in n)if(k!=='loc'){if(Array.isArray(n[k]))n[k].forEach(walk);else if(n[k]&&typeof n[k]==='object')walk(n[k]);}
}walk(ast);
for(const [line,value] of Object.entries(copy)){const n=literals.get(+line);if(!n)throw Error('Missing literal at '+line);if(edits.some(e=>e.start===n.start))continue;edits.push({start:n.start,end:n.end,text:JSON.stringify(value)});}
let result=input;for(const e of edits.sort((a,b)=>b.start-a.start))result=result.slice(0,e.start)+e.text+result.slice(e.end);
function replace(a,b){if(!result.includes(a))throw Error('Missing patch '+a);result=result.replace(a,b);}
// Remove numeric axes from the illustrative scope chart. Retain its original geometry.
replace('i.fillText(f === 1 ? "1 hour" : f + "", 110, u(f) - 13)','i.fillText("", 110, u(f) - 13)');
replace('i.fillText(String(f), h, u(0) + 44)','i.fillText(f === 2019 ? "FOUNDATION" : f === 2023 ? "ECOSYSTEMS" : f === 2027 ? "NEXT" : "", h, u(0) + 44)');
replace('Rt + "",','"",');
// Label the running swarm counter as illustration time, rather than fabricated work.
replace('var KA = (1e6 * 50) / 31557600','var KA = 1');
// Start promptly; the original engine already warms adjacent scenes in the background.
replace('!o && !s.has("quick")','!o && s.has("preload")');
// Defer boot until the reader chooses to enter the animated presentation.
replace('  C3({\n    createDeck: A3,','  window.startBlocksphere = () => C3({\n    createDeck: A3,');
fs.writeFileSync(path.join(out,'assets/deck.js'),result);
// assets/embedded.js is the unchanged original font and asset bundle.


const provenance=JSON.parse(fs.readFileSync(path.join(root,'provenance.json')));
provenance.chapters=chapterNo;provenance.literalEdits=edits.length;
fs.writeFileSync(path.join(root,'provenance.json'),JSON.stringify(provenance,null,2));
console.log(JSON.stringify({chapters:chapterNo,edits:edits.length,bytes:result.length}));
