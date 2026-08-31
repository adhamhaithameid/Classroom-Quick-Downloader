/** SVG Design System — public barrel. Types live in ./types so sibling
 * modules never import from this file (breaks the former type-only cycle). */

export type { SvgItem, SvgCategory, ThreeDItem } from './types';
export { S } from './types';

import { categories as c1 } from './float1';
import { categories as c2 } from './float2';
import { categories as c3 } from './float3';
import { categories as c4 } from './float4';
import type { SvgCategory } from './types';
export { threeDElements } from './threeD';
export { doodleItems } from './doodles';

export const categories: SvgCategory[] = [...c1, ...c2, ...c3, ...c4];

