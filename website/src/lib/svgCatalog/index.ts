/** SVG Design System — Types & Index */

export interface SvgItem {
  id: string;
  label: string;
  svg: string;
}

export interface SvgCategory {
  key: string;
  name: string;
  emoji: string;
  items: SvgItem[];
}

export type ThreeDItem = SvgItem;

export const S = (id: string, label: string, svg: string): SvgItem => ({ id, label, svg });

import { categories as c1 } from './float1';
import { categories as c2 } from './float2';
import { categories as c3 } from './float3';
import { categories as c4 } from './float4';
export { threeDElements } from './threeD';
export { doodleItems } from './doodles';

export const categories: SvgCategory[] = [...c1, ...c2, ...c3, ...c4];

