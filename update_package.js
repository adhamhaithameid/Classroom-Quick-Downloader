const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
delete pkg.pnpm.overrides['wxt>picomatch'];
pkg.pnpm.overrides['@aklinker1/rollup-plugin-visualizer>picomatch'] = '>=4.0.4';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
