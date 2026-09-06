/** SVG Design System — shared types & helpers (single source of truth) */

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
