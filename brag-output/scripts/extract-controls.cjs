// Extract the real product stylesheet without changing or running the extension.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const ts = require(require.resolve('typescript', {paths:[path.join(root,'extension')]}));
const dest = path.resolve(__dirname,'../composition/assets');
const modules = {};
let css = '';
function load(file) {
  if (modules[file]) return modules[file];
  const exports = {};
  const source = fs.readFileSync(file,'utf8');
  const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(js, {exports, require:(name)=>load(path.resolve(path.dirname(file),name+'.ts')), encodeURIComponent,
    document:{getElementById:()=>null,createElement:()=>({textContent:''}),head:{appendChild:(node)=>{css=node.textContent;}}}}, {filename:file});
  return modules[file]=exports;
}
const base=path.join(root,'extension/entrypoints/content');
load(path.join(base,'styles.ts')).injectStyles();
fs.writeFileSync(path.join(dest,'cqd-controls.css'),css);
const icons=load(path.join(base,'icons.ts'));
fs.writeFileSync(path.join(dest,'download.svg'),icons.DOWNLOAD_ICON_SVG_RAW);
fs.writeFileSync(path.join(dest,'success.svg'),icons.SUCCESS_ICON_SVG_RAW);
console.log('Extracted original control CSS and icons.');
