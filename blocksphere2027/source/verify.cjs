const fs=require('fs'),path=require('path'),zlib=require('zlib'),assert=require('assert'),crypto=require('crypto'),acorn=require('acorn');
const root=path.resolve(__dirname,'..');
const original=zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'original-script-3.js.gz')));
const provenance=JSON.parse(fs.readFileSync(path.join(__dirname,'provenance.json')));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(hash(original),provenance.originalEngineSHA256,'Exact source engine archive');
assert.equal(hash(fs.readFileSync(path.join(root,'assets/embedded.js'))),provenance.originalEmbeddedSHA256,'Exact embedded assets');
function extract(code){const ast=acorn.parse(code,{ecmaVersion:'latest'}),shaders=[],scenes=[];function walk(n){if(!n||typeof n!=='object')return;const v=n.type==='Literal'?n.value:n.type==='TemplateLiteral'?n.quasis.map(x=>x.value.raw).join(''):null;if(typeof v==='string'&&/gl_Position|uniform |precision highp|void main\(/.test(v))shaders.push(v);if(n.type==='ObjectExpression'&&n.properties.some(p=>p.key?.name==='beats')){const val=k=>n.properties.find(p=>p.key?.name===k)?.value;const id=val('id')?.value;if(id)scenes.push({id,transition:val('enterWith')?.value,beats:val('beats').elements.map(b=>Object.fromEntries(b.properties.filter(p=>p.key?.name!=='page').map(p=>[p.key.name,p.value.type==='Literal'?p.value.value:p.value.name])))});}for(const k in n){if(Array.isArray(n[k]))n[k].forEach(walk);else if(n[k]&&typeof n[k]==='object')walk(n[k]);}}walk(ast);return {shaders,scenes};}
const before=extract(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'original-readable.js.gz'))).toString());
const after=extract(fs.readFileSync(path.join(root,'assets/deck.js'),'utf8'));
assert.deepEqual(after.shaders,before.shaders,'Original shaders');
assert.deepEqual(after.scenes,before.scenes,'Original scenes, transitions and animation timing');
const chapters=JSON.parse(fs.readFileSync(path.join(root,'chapters.json'))),sources=JSON.parse(fs.readFileSync(path.join(root,'sources.json')));
assert.deepEqual(chapters.map(c=>c.id),after.scenes.map(c=>c.id));
chapters.forEach((c,i)=>{assert.equal(c.notes.length,after.scenes[i].beats.length,c.id+' note count');c.sources.forEach(id=>assert(sources[id],id));assert(fs.existsSync(path.join(root,'assets/thumb-'+c.id+'.svg')));});
const portfolio=JSON.parse(fs.readFileSync(path.join(__dirname,'portfolio-snapshot.json')));assert.equal(portfolio.archive.length,37);
for(const f of ['index.html','original.css','site.css','site.js','assets/blocksphere-assets.js','assets/pandu.jpg','assets/gilang.jpg','assets/danny.jpg'])assert(fs.statSync(path.join(root,f)).size>0,f);
console.log(`Verified exact engine archive and asset bundle; ${after.shaders.length} unchanged shader strings; ${after.scenes.length} original scenes with unchanged transitions and timings; chapter notes, references and portfolio count.`);
