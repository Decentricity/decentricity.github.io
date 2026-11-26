const fs=require('fs'),path=require('path'),zlib=require('zlib'),acorn=require('../../source/node_modules/acorn');
const root=path.resolve(__dirname,'..'),donor=path.resolve(root,'../source');
const input=zlib.gunzipSync(fs.readFileSync(path.join(donor,'original-readable.js.gz'))).toString();
const copy=JSON.parse(fs.readFileSync(path.join(__dirname,'copy.json'))),chapters=JSON.parse(fs.readFileSync(path.join(root,'chapters.json'))),ast=acorn.parse(input,{ecmaVersion:'latest',locations:true});
let edits=[],literals=new Map();
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='Literal'&&typeof n.value==='string'||n.type==='TemplateLiteral'&&!n.expressions.length){if(!literals.has(n.loc.start.line)||[44054,44059,44061,44063,44149].includes(n.loc.start.line))literals.set(n.loc.start.line,n)}
if(n.type==='ObjectExpression'){const id=n.properties.find(p=>p.key?.name==='id')?.value?.value,c=chapters.find(c=>c.id===id);if(c&&n.properties.some(p=>p.key?.name==='beats')){for(const key of ['title','notes']){const p=n.properties.find(p=>p.key?.name===key);edits.push({start:p.value.start,end:p.value.end,text:JSON.stringify(c[key])})}const beats=n.properties.find(p=>p.key?.name==='beats').value.elements;beats.forEach((b,i)=>{const p=b.properties.find(p=>p.key?.name==='page');edits.push({start:p.value.start,end:p.value.end,text:JSON.stringify(String(chapters.indexOf(c)+1).padStart(2,'0')+' / '+(i+1))})})}}
for(const k in n)if(k!=='loc'){if(Array.isArray(n[k]))n[k].forEach(walk);else if(n[k]&&typeof n[k]==='object')walk(n[k])}}
walk(ast);for(const[line,value]of Object.entries(copy)){const n=literals.get(+line);if(!n)throw Error('Missing literal '+line);if(!edits.some(e=>e.start===n.start))edits.push({start:n.start,end:n.end,text:JSON.stringify(value)})}
let result=input;for(const e of edits.sort((a,b)=>b.start-a.start))result=result.slice(0,e.start)+e.text+result.slice(e.end);
function replace(a,b){if(!result.includes(a))throw Error('Missing patch '+a);result=result.replace(a,b)}
replace('i.fillText(f === 1 ? "1 hour" : f + "", 110, u(f) - 13)','i.fillText("", 110, u(f) - 13)');replace('i.fillText(String(f), h, u(0) + 44)','i.fillText(f === 2019 ? "2017" : f === 2023 ? "2021" : f === 2027 ? "2026" : "", h, u(0) + 44)');replace('Rt + "",','"",');replace('var KA = (1e6 * 50) / 31557600','var KA = 1');
result=result.replace(/var Eh = \[[\s\S]*?\n    \],/, 'var Eh = '+JSON.stringify(chapters.slice(0,chapters.findIndex(c=>c.id==='pile')).map(c=>c.id))+',');
const at=result.lastIndexOf('  C3({\n    createDeck: A3,');if(at<0)throw Error('Boot boundary missing');
result=result.slice(0,at)+`  window.PitchEngine={create:A3,audio:G3,scenes:{office:$3,tower:My,boat:Ky,swarm:g5,dominoes:X5,lamp:lb,selectall:yb,pile:Gb,questions:qb},transitions:{fade:P3,'portal-in':Xb,'portal-out':Yb,fold:$b,wash:Zb,flaps:tw,slam:iw,daybreak:sw,line:aw,tear:lw}};\n})();\n`;
fs.writeFileSync(path.join(root,'engine.js'),result);console.log('Built pitch with original geometry, camera paths, shaders and transitions; '+edits.length+' copy edits.');
