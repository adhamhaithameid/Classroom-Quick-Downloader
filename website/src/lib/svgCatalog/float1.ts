import type { SvgCategory } from './index';
const S = (id: string, l: string, s: string) => ({ id, label: l, svg: s });

export const categories: SvgCategory[] = [
  {
    key: 'downloads', name: 'Downloads', emoji: '⬇️',
    items: [
      S('F-1-1','Arrow Down Tray','<path d="M32 8v28"/><path d="M20 28l12 12 12-12"/><rect x="12" y="48" width="40" height="6" rx="2"/>'),
      S('F-1-2','Save To Disk','<rect x="14" y="8" width="36" height="44" rx="3"/><rect x="22" y="8" width="20" height="14" rx="2"/><rect x="20" y="34" width="24" height="12" rx="2"/><circle cx="32" cy="40" r="3"/>'),
      S('F-1-3','Download Speed','<circle cx="32" cy="32" r="20"/><path d="M32 18v20"/><path d="M24 32l8 8 8-8"/><path d="M18 48h28"/>'),
      S('F-1-4','Cloud Download','<path d="M18 34a10 10 0 0 1 0-20 14 14 0 0 1 26-2 8 8 0 0 1 2 16"/><path d="M32 30v18"/><path d="M24 42l8 8 8-8"/>'),
      S('F-1-5','Package Box','<rect x="12" y="20" width="40" height="28" rx="3"/><path d="M12 20l20-12 20 12"/><line x1="32" y1="8" x2="32" y2="34"/><line x1="22" y1="34" x2="42" y2="34"/>'),
      S('F-1-6','Progress Bar','<rect x="10" y="24" width="44" height="14" rx="4"/><rect x="12" y="26" width="28" height="10" rx="3" fill="currentColor" opacity="0.12"/><path d="M32 8v10"/><path d="M26 14l6 6 6-6"/>'),
      S('F-1-7','Hard Drive','<rect x="10" y="22" width="44" height="20" rx="4"/><line x1="10" y1="32" x2="54" y2="32"/><circle cx="46" cy="27" r="2"/><circle cx="46" cy="37" r="2"/><line x1="16" y1="37" x2="28" y2="37"/>'),
      S('F-1-8','Download Done','<circle cx="32" cy="32" r="20"/><path d="M22 32l7 7 13-13"/>'),
      S('F-1-9','Sync Arrows','<path d="M42 18H20a8 8 0 0 0-8 8v4"/><path d="M36 12l8 6-8 6"/><path d="M22 46h22a8 8 0 0 0 8-8v-4"/><path d="M28 52l-8-6 8-6"/>'),
      S('F-1-10','Batch Tiles','<rect x="8" y="8" width="18" height="18" rx="2"/><rect x="30" y="8" width="18" height="18" rx="2"/><rect x="8" y="30" width="18" height="18" rx="2"/><rect x="30" y="30" width="18" height="18" rx="2"/><path d="M17 15v4"/><path d="M15 17h4"/><path d="M39 15v4"/><path d="M37 17h4"/><path d="M17 37v4"/><path d="M15 39h4"/><path d="M39 37v4"/><path d="M37 39h4"/>'),
    ]
  },
  {
    key: 'browser', name: 'Browser', emoji: '🌐',
    items: [
      S('F-2-1','Browser Window','<rect x="8" y="12" width="48" height="40" rx="4"/><line x1="8" y1="22" x2="56" y2="22"/><circle cx="16" cy="17" r="2"/><circle cx="23" cy="17" r="2"/><circle cx="30" cy="17" r="2"/>'),
      S('F-2-2','Puzzle Piece','<path d="M22 14h8v-4a4 4 0 0 1 8 0v4h8v8h4a4 4 0 0 1 0 8h-4v8H22V14z"/>'),
      S('F-2-3','Code Editor','<rect x="8" y="10" width="48" height="44" rx="4"/><line x1="8" y1="20" x2="56" y2="20"/><line x1="18" y1="30" x2="38" y2="30"/><line x1="18" y1="38" x2="46" y2="38"/><line x1="18" y1="46" x2="34" y2="46"/>'),
      S('F-2-4','Web Globe','<circle cx="32" cy="32" r="20"/><ellipse cx="32" cy="32" rx="8" ry="20"/><line x1="12" y1="32" x2="52" y2="32"/><line x1="14" y1="22" x2="50" y2="22"/><line x1="14" y1="42" x2="50" y2="42"/>'),
      S('F-2-5','URL Bar','<rect x="8" y="22" width="48" height="20" rx="10"/><circle cx="20" cy="32" r="4"/><line x1="28" y1="32" x2="48" y2="32"/>'),
      S('F-2-6','Multi Tab','<rect x="6" y="18" width="52" height="36" rx="4"/><line x1="6" y1="26" x2="58" y2="26"/><path d="M6 18h16v-8h14v8"/>'),
      S('F-2-7','Toolbar','<rect x="8" y="14" width="48" height="38" rx="4"/><line x1="8" y1="24" x2="56" y2="24"/><rect x="30" y="17" width="20" height="4" rx="2"/><rect x="14" y="30" width="18" height="14" rx="2"/>'),
      S('F-2-8','Popup','<rect x="14" y="8" width="36" height="30" rx="3"/><line x1="14" y1="16" x2="50" y2="16"/><rect x="8" y="28" width="32" height="24" rx="3"/><line x1="8" y1="36" x2="40" y2="36"/>'),
      S('F-2-9','Link Chain','<path d="M24 28a8 8 0 0 1 8-8h4a8 8 0 0 1 0 16h-4"/><path d="M40 36a8 8 0 0 1-8 8h-4a8 8 0 0 1 0-16h4"/>'),
      S('F-2-10','Bookmark','<path d="M20 8h24v44l-12-8-12 8V8z"/>'),
    ]
  },
  {
    key: 'time', name: 'Time', emoji: '⏱️',
    items: [
      S('F-3-1','Wall Clock','<circle cx="32" cy="32" r="22"/><path d="M32 16v16l10 8"/><circle cx="32" cy="32" r="2" fill="currentColor" opacity="0.3"/>'),
      S('F-3-2','Stopwatch','<circle cx="32" cy="36" r="18"/><path d="M32 22v14l8 6"/><line x1="32" y1="10" x2="32" y2="18"/><path d="M28 10h8"/>'),
      S('F-3-3','Hourglass','<ellipse cx="32" cy="14" rx="12" ry="5"/><ellipse cx="32" cy="50" rx="12" ry="5"/><path d="M20 14c0 10 12 16 12 18s-12 8-12 18"/><path d="M44 14c0 10-12 16-12 18s12 8 12 18"/>'),
      S('F-3-4','Fast Forward','<path d="M10 18v28l18-14z"/><path d="M30 18v28l18-14z"/><line x1="52" y1="18" x2="52" y2="46"/>'),
      S('F-3-5','Lightning','<path d="M36 6L18 30h12L24 58l22-30H34z"/>'),
      S('F-3-6','Speed Lines','<line x1="6" y1="22" x2="32" y2="22"/><line x1="10" y1="30" x2="40" y2="30"/><line x1="6" y1="38" x2="36" y2="38"/><path d="M46 22l10 10-10 10"/>'),
      S('F-3-7','Timer Ring','<circle cx="32" cy="32" r="22" stroke-dasharray="110 28"/><path d="M32 16v16l10 8"/>'),
      S('F-3-8','Rewind','<circle cx="32" cy="34" r="20"/><path d="M32 20v14l-10 6"/><path d="M14 16l-4 8h10"/>'),
      S('F-3-9','Alarm Clock','<circle cx="32" cy="36" r="18"/><path d="M32 24v12l8 4"/><path d="M14 14l8 6"/><path d="M50 14l-8 6"/><line x1="32" y1="8" x2="32" y2="18"/>'),
      S('F-3-10','Calendar Day','<rect x="12" y="12" width="40" height="40" rx="4"/><line x1="12" y1="24" x2="52" y2="24"/><line x1="24" y1="6" x2="24" y2="16"/><line x1="40" y1="6" x2="40" y2="16"/><rect x="20" y="30" width="10" height="10" rx="2" fill="currentColor" opacity="0.1"/>'),
    ]
  },
  {
    key: 'documents', name: 'Documents', emoji: '📄',
    items: [
      S('F-4-1','Page','<rect x="14" y="6" width="28" height="40" rx="3"/><line x1="20" y1="16" x2="36" y2="16"/><line x1="20" y1="24" x2="34" y2="24"/><line x1="20" y1="32" x2="30" y2="32"/>'),
      S('F-4-2','Stack','<rect x="10" y="14" width="24" height="32" rx="2"/><rect x="18" y="8" width="24" height="32" rx="2"/>'),
      S('F-4-3','Clipboard','<rect x="16" y="12" width="32" height="42" rx="3"/><path d="M26 12V8h12v4"/><line x1="22" y1="24" x2="42" y2="24"/><line x1="22" y1="32" x2="38" y2="32"/><line x1="22" y1="40" x2="34" y2="40"/>'),
      S('F-4-4','Folder Plus','<path d="M10 22v26h44V28H34l-6-6H10z"/><line x1="32" y1="34" x2="32" y2="44"/><line x1="27" y1="39" x2="37" y2="39"/>'),
      S('F-4-5','Checklist','<rect x="12" y="8" width="40" height="48" rx="3"/><line x1="24" y1="20" x2="44" y2="20"/><line x1="24" y1="30" x2="44" y2="30"/><line x1="24" y1="40" x2="44" y2="40"/><path d="M16 18l2 2 4-4"/><path d="M16 28l2 2 4-4"/><path d="M16 38l2 2 4-4"/>'),
      S('F-4-6','Sticky Note','<rect x="12" y="12" width="40" height="40" rx="2"/><path d="M36 52V40h16"/><path d="M36 52l16-12"/><line x1="18" y1="22" x2="36" y2="22"/><line x1="18" y1="30" x2="30" y2="30"/>'),
      S('F-4-7','Copy','<rect x="10" y="14" width="24" height="32" rx="2"/><rect x="22" y="6" width="24" height="32" rx="2"/>'),
      S('F-4-8','Spreadsheet','<rect x="10" y="10" width="44" height="44" rx="3"/><line x1="10" y1="22" x2="54" y2="22"/><line x1="10" y1="34" x2="54" y2="34"/><line x1="10" y1="46" x2="54" y2="46"/><line x1="26" y1="10" x2="26" y2="54"/><line x1="42" y1="10" x2="42" y2="54"/>'),
      S('F-4-9','PDF','<rect x="14" y="8" width="28" height="40" rx="3"/><path d="M14 8h18l10 10v30"/><line x1="32" y1="8" x2="32" y2="18"/><line x1="32" y1="18" x2="42" y2="18"/>'),
      S('F-4-10','Box','<rect x="10" y="18" width="44" height="32" rx="3"/><rect x="10" y="10" width="44" height="12" rx="3"/><rect x="28" y="28" width="8" height="6" rx="2"/>'),
    ]
  },
  {
    key: 'education', name: 'Education', emoji: '🎓',
    items: [
      S('F-5-1','Grad Cap','<path d="M32 12L6 26l26 14 26-14z"/><path d="M18 34v12c0 4 14 7 14 7s14-3 14-7V34"/><line x1="54" y1="26" x2="54" y2="46"/>'),
      S('F-5-2','Book','<path d="M32 16L10 10v36l22 6 22-6V10z"/><line x1="32" y1="16" x2="32" y2="48"/>'),
      S('F-5-3','Pencil','<path d="M42 10l8 8-24 24-12 4 4-12z"/><line x1="38" y1="14" x2="46" y2="22"/>'),
      S('F-5-4','Desk Lamp','<line x1="18" y1="52" x2="46" y2="52"/><line x1="32" y1="52" x2="32" y2="38"/><path d="M32 38l-16-20h28z"/><line x1="16" y1="18" x2="48" y2="18"/>'),
      S('F-5-5','Chalkboard','<rect x="8" y="12" width="48" height="32" rx="2"/><line x1="22" y1="50" x2="42" y2="50"/><line x1="16" y1="24" x2="36" y2="24"/><line x1="16" y1="32" x2="28" y2="32"/>'),
      S('F-5-6','School Bell','<path d="M32 8v4"/><path d="M32 12c-12 0-20 12-20 24h40c0-12-8-24-20-24z"/><path d="M12 36h40"/><path d="M32 42v8"/><circle cx="32" cy="52" r="3"/>'),
      S('F-5-7','Apple','<path d="M32 10s8-8 14 0c4 6 2 18-4 24s-10 10-10 10-4-4-10-10-8-18-4-24c6-8 14 0 14 0z"/>'),
      S('F-5-8','Calculator','<rect x="16" y="8" width="32" height="48" rx="4"/><rect x="20" y="12" width="24" height="12" rx="2"/><circle cx="26" cy="34" r="2.5"/><circle cx="32" cy="34" r="2.5"/><circle cx="38" cy="34" r="2.5"/><circle cx="26" cy="42" r="2.5"/><circle cx="32" cy="42" r="2.5"/><circle cx="38" cy="42" r="2.5"/>'),
      S('F-5-9','Diploma','<rect x="8" y="14" width="48" height="36" rx="6"/><line x1="18" y1="26" x2="46" y2="26"/><line x1="22" y1="34" x2="42" y2="34"/><path d="M32 50v6"/><line x1="26" y1="56" x2="38" y2="56"/>'),
      S('F-5-10','Ruler','<rect x="8" y="26" width="48" height="12" rx="2"/><line x1="16" y1="26" x2="16" y2="32"/><line x1="24" y1="26" x2="24" y2="34"/><line x1="32" y1="26" x2="32" y2="32"/><line x1="40" y1="26" x2="40" y2="34"/><line x1="48" y1="26" x2="48" y2="32"/>'),
    ]
  },
];
