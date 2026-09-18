import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { injectStyles, injectStudentWorkStyles } from '../entrypoints/content/styles';

it('scratch: dumps both sheet outputs', () => {
  injectStyles();
  injectStudentWorkStyles();
  writeFileSync('/tmp/css-before-full.css', document.getElementById('cqd-style')?.textContent ?? '');
  writeFileSync('/tmp/css-before-sw.css', document.getElementById('cqd-sw-style')?.textContent ?? '');
});
