import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('student_work_resolver_bridge entrypoint regression guards', () => {
  const entrypointPath = resolve(process.cwd(), 'entrypoints/student_work_resolver_bridge.content.ts');
  const source = readFileSync(entrypointPath, 'utf-8');

  it('loads on both regular and authuser-prefixed viewer routes', () => {
    expect(source).toContain("'https://classroom.google.com/g/tg/*'");
    expect(source).toContain("'https://classroom.google.com/u/*/g/tg/*'");
  });

  it('runs in all frames so iframe resolver mode can publish results', () => {
    expect(source).toContain('allFrames: true');
  });
});
