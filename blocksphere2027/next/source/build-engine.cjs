// Preserve the existing bundle and its dependency graph; change only its public boot boundary.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const input=fs.readFileSync(path.resolve(root,'../assets/deck.js'),'utf8');
const marker='  window.startBlocksphere = () => C3({';
const at=input.lastIndexOf(marker);if(at<0)throw Error('Engine boot boundary missing');
const bridge=`  window.ArchiveEngine = Object.freeze({create:A3,THREE:Le,audio:G3,transitions:{fade:P3,'portal-in':Xb,'portal-out':Yb,fold:$b,wash:Zb,flaps:tw,slam:iw,daybreak:sw,line:aw,tear:lw}});\n})();\n`;
fs.writeFileSync(path.join(root,'engine.js'),input.slice(0,at)+bridge);
fs.writeFileSync(path.join(root,'source/engine-provenance.json'),JSON.stringify({source:'../assets/deck.js',sourceSha256:crypto.createHash('sha256').update(input).digest('hex'),change:'Replace boot registration with an explicit engine adapter. Original engine, shader and transition implementations retained.'},null,2));
