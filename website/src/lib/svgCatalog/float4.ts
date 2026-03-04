import type { SvgCategory } from './index';
const S = (id: string, l: string, s: string) => ({ id, label: l, svg: s });

export const categories: SvgCategory[] = [
  {
    key: 'cloud', name: 'Cloud', emoji: '☁️',
    items: [
      S('F-16-1','Cloud Shape','<path d="M22 44a10 10 0 0 1-4-20 12 12 0 0 1 22-4 8 8 0 0 1 6 16H22z"/><line x1="22" y1="50" x2="46" y2="50"/>'),
      S('F-16-2','Upload','<path d="M18 42a10 10 0 0 1-2-20 14 14 0 0 1 26-2 8 8 0 0 1 6 16"/><path d="M32 48V30"/><path d="M24 36l8-8 8 8"/>'),
      S('F-16-3','Data Cycle','<circle cx="32" cy="32" r="18"/><path d="M32 14v10l6-4"/><path d="M32 50V40l-6 4"/><line x1="22" y1="32" x2="42" y2="32"/>'),
      S('F-16-4','Storage','<rect x="10" y="14" width="44" height="12" rx="4"/><rect x="10" y="30" width="44" height="12" rx="4"/><circle cx="44" cy="20" r="2"/><circle cx="44" cy="36" r="2"/>'),
      S('F-16-5','Cloud Done','<path d="M20 40a10 10 0 0 1-2-18 14 14 0 0 1 26-2 8 8 0 0 1 4 14"/><path d="M22 36l6 6 14-14"/>'),
      S('F-16-6','Server','<rect x="14" y="8" width="36" height="14" rx="3"/><rect x="14" y="26" width="36" height="14" rx="3"/><rect x="14" y="44" width="36" height="14" rx="3"/><circle cx="42" cy="15" r="2"/><circle cx="42" cy="33" r="2"/><circle cx="42" cy="51" r="2"/>'),
      S('F-16-7','Restore','<path d="M20 38a10 10 0 0 1-2-16 14 14 0 0 1 26-2 8 8 0 0 1 4 12"/><path d="M32 30v16"/><path d="M24 40l8 8 8-8"/>'),
      S('F-16-8','CDN','<circle cx="32" cy="32" r="6"/><circle cx="14" cy="14" r="4"/><circle cx="50" cy="14" r="4"/><circle cx="14" cy="50" r="4"/><circle cx="50" cy="50" r="4"/><line x1="28" y1="28" x2="18" y2="18"/><line x1="36" y1="28" x2="46" y2="18"/><line x1="28" y1="36" x2="18" y2="46"/><line x1="36" y1="36" x2="46" y2="46"/>'),
      S('F-16-9','Deploy','<path d="M32 8v32"/><path d="M22 18l10-10 10 10"/><rect x="12" y="46" width="40" height="8" rx="3"/><circle cx="46" cy="50" r="2"/>'),
      S('F-16-10','Antenna','<line x1="32" y1="20" x2="32" y2="54"/><circle cx="32" cy="16" r="4"/><path d="M20 26c0 8 12 10 12 10s12-2 12-10"/><path d="M14 32c0 10 18 14 18 14s18-4 18-14"/>'),
    ]
  },
  {
    key: 'arrows', name: 'Arrows', emoji: '➡️',
    items: [
      S('F-17-1','Right Arrow','<line x1="8" y1="32" x2="54" y2="32"/><path d="M44 22l12 10-12 10"/>'),
      S('F-17-2','Diagonal','<line x1="14" y1="50" x2="50" y2="14"/><path d="M36 14h14v14"/>'),
      S('F-17-3','Curved','<path d="M12 44Q12 16 40 16"/><path d="M34 10l8 6-8 6"/>'),
      S('F-17-4','Fork','<line x1="32" y1="8" x2="32" y2="28"/><path d="M32 28l-16 18h32z"/>'),
      S('F-17-5','Redo','<path d="M14 44a20 20 0 0 1 36-12"/><path d="M50 24v10h-10"/>'),
      S('F-17-6','Exchange','<path d="M8 22h40"/><path d="M42 16l8 6-8 6"/><path d="M56 42H16"/><path d="M22 36l-8 6 8 6"/>'),
      S('F-17-7','Fullscreen','<path d="M8 22V8h14"/><path d="M56 22V8H42"/><path d="M8 42v14h14"/><path d="M56 42v14H42"/>'),
      S('F-17-8','Merge','<path d="M12 16l20 16"/><path d="M12 48l20-16"/><line x1="32" y1="32" x2="52" y2="32"/><path d="M46 26l8 6-8 6"/>'),
      S('F-17-9','Bounce','<path d="M10 18q12 28 22 0t22 0"/>'),
      S('F-17-10','Cycle','<circle cx="32" cy="32" r="18"/><path d="M32 14l6 6h-12z"/><path d="M46 40l-6 6v-12z"/><path d="M18 40l6 6v-12z"/>'),
    ]
  },
  {
    key: 'shapes', name: 'Shapes', emoji: '🔷',
    items: [
      S('F-18-1','Hexagon','<path d="M32 6L54 18v28L32 58 10 46V18z"/>'),
      S('F-18-2','Diamond','<path d="M32 6L56 32 32 58 8 32z"/>'),
      S('F-18-3','Octagon','<path d="M22 6h20l14 14v24l-14 14H22L8 44V20z"/>'),
      S('F-18-4','Pentagon','<path d="M32 6l22 16-8 24H22L14 22z"/>'),
      S('F-18-5','Cross','<path d="M24 8h16v16h16v16H40v16H24V40H8V24h16z"/>'),
      S('F-18-6','Circle Ring','<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="12"/>'),
      S('F-18-7','Triangle','<path d="M32 8L54 52H10z"/>'),
      S('F-18-8','Cube','<path d="M32 10l20 12v20L32 54 12 42V22z"/><path d="M32 10v44"/><path d="M12 22l20 12 20-12"/>'),
      S('F-18-9','Zigzag','<path d="M8 16l12 16L32 16l12 16L56 16"/><path d="M8 32l12 16L32 32l12 16L56 32"/>'),
      S('F-18-10','Wave','<path d="M4 32q8-16 14 0t14 0 14 0 14 0" fill="none"/>'),
    ]
  },
  {
    key: 'nature', name: 'Nature', emoji: '🌿',
    items: [
      S('F-19-1','Sprout','<path d="M32 54V32"/><path d="M18 32c0-10 14-18 14-18s14 8 14 18"/><path d="M32 40c-6-4-10-10-10-16"/>'),
      S('F-19-2','Sun','<circle cx="32" cy="32" r="10"/><line x1="32" y1="8" x2="32" y2="16"/><line x1="32" y1="48" x2="32" y2="56"/><line x1="8" y1="32" x2="16" y2="32"/><line x1="48" y1="32" x2="56" y2="32"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="43" y1="43" x2="49" y2="49"/><line x1="49" y1="15" x2="43" y2="21"/><line x1="21" y1="43" x2="15" y2="49"/>'),
      S('F-19-3','Mountain','<path d="M4 52l18-32 8 12 12-20 18 40z"/>'),
      S('F-19-4','Tree','<path d="M32 54V30"/><path d="M20 34l12-22 12 22z"/><path d="M16 46l16-24 16 24z"/>'),
      S('F-19-5','Water','<path d="M4 28q8-8 14 0t14 0 14 0 14 0"/><path d="M4 38q8-8 14 0t14 0 14 0 14 0"/><path d="M4 48q8-8 14 0t14 0 14 0 14 0"/>'),
      S('F-19-6','Flower','<circle cx="32" cy="32" r="6"/><circle cx="32" cy="16" r="6" opacity="0.5"/><circle cx="46" cy="24" r="6" opacity="0.5"/><circle cx="46" cy="40" r="6" opacity="0.5"/><circle cx="32" cy="48" r="6" opacity="0.5"/><circle cx="18" cy="40" r="6" opacity="0.5"/><circle cx="18" cy="24" r="6" opacity="0.5"/>'),
      S('F-19-7','Droplets','<path d="M22 40a8 8 0 1 0 0-16l8-16 8 16a8 8 0 1 0 0 16"/><path d="M42 48a6 6 0 1 0 0-12l6-12 6 12a6 6 0 1 0 0 12"/>'),
      S('F-19-8','Moon','<path d="M36 8a22 22 0 1 0 0 48 18 18 0 0 1 0-48z"/>'),
      S('F-19-9','Breeze','<line x1="8" y1="20" x2="40" y2="20"/><line x1="14" y1="30" x2="50" y2="30"/><line x1="8" y1="40" x2="36" y2="40"/><path d="M44 24l8 6-8 6"/>'),
      S('F-19-10','Seedling','<path d="M32 54V32"/><path d="M32 32Q18 32 18 18Q32 18 32 32z"/><path d="M32 40Q44 40 44 28Q32 28 32 40z"/>'),
    ]
  },
  {
    key: 'misc', name: 'Miscellaneous', emoji: '✨',
    items: [
      S('F-20-1','QR Code','<rect x="8" y="8" width="18" height="18" rx="2"/><rect x="38" y="8" width="18" height="18" rx="2"/><rect x="8" y="38" width="18" height="18" rx="2"/><rect x="12" y="12" width="10" height="10" rx="1" fill="currentColor" opacity="0.1"/><rect x="42" y="12" width="10" height="10" rx="1" fill="currentColor" opacity="0.1"/><rect x="12" y="42" width="10" height="10" rx="1" fill="currentColor" opacity="0.1"/>'),
      S('F-20-2','Pin','<circle cx="32" cy="22" r="12"/><path d="M26 32l-6 20h24l-6-20"/>'),
      S('F-20-3','Ticket','<rect x="8" y="18" width="48" height="28" rx="4"/><line x1="22" y1="18" x2="22" y2="46" stroke-dasharray="3 3"/><circle cx="36" cy="32" r="4"/>'),
      S('F-20-4','Scissors','<circle cx="20" cy="44" r="6"/><circle cx="44" cy="44" r="6"/><path d="M24 40l20-28"/><path d="M40 40L20 12"/>'),
      S('F-20-5','Compass','<circle cx="32" cy="32" r="22"/><path d="M32 14v6"/><path d="M32 44v6"/><path d="M14 32h6"/><path d="M44 32h6"/><path d="M28 28l-4-6 12 8z" fill="currentColor" opacity="0.15"/><path d="M36 36l4 6-12-8z" fill="currentColor" opacity="0.15"/>'),
      S('F-20-6','Infinity','<path d="M32 32c-4-8-16-12-16 0s12 8 16 0 16-12 16 0-12 8-16 0z"/>'),
      S('F-20-7','Battery','<rect x="8" y="18" width="44" height="28" rx="4"/><rect x="52" y="26" width="4" height="12" rx="1"/><rect x="12" y="22" width="24" height="20" rx="2" fill="currentColor" opacity="0.1"/>'),
      S('F-20-8','Puzzle','<rect x="10" y="10" width="44" height="44" rx="4"/><line x1="32" y1="10" x2="32" y2="54"/><line x1="10" y1="32" x2="54" y2="32"/><circle cx="32" cy="10" r="4"/><circle cx="54" cy="32" r="4"/>'),
      S('F-20-9','Clipboard Check','<rect x="16" y="14" width="32" height="38" rx="3"/><path d="M26 14V10h12v4"/><path d="M24 34l6 6 12-12"/>'),
      S('F-20-10','Atom','<circle cx="32" cy="32" r="4"/><ellipse cx="32" cy="32" rx="22" ry="8"/><ellipse cx="32" cy="32" rx="22" ry="8" transform="rotate(60 32 32)"/><ellipse cx="32" cy="32" rx="22" ry="8" transform="rotate(120 32 32)"/>'),
    ]
  },
];
