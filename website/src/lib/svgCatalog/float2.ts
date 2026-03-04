import type { SvgCategory } from './index';
const S = (id: string, l: string, s: string) => ({ id, label: l, svg: s });

export const categories: SvgCategory[] = [
  {
    key: 'security', name: 'Security', emoji: '🔒',
    items: [
      S('F-6-1','Shield','<path d="M32 8L12 18v14c0 14 20 22 20 22s20-8 20-22V18z"/>'),
      S('F-6-2','Lock','<rect x="20" y="30" width="24" height="20" rx="3"/><path d="M24 30v-8a8 8 0 0 1 16 0v8"/><circle cx="32" cy="40" r="2.5"/>'),
      S('F-6-3','Eye Off','<path d="M8 32s10-16 24-16 24 16 24 16"/><circle cx="32" cy="32" r="7"/><line x1="14" y1="50" x2="50" y2="14"/>'),
      S('F-6-4','Key','<circle cx="22" cy="24" r="8"/><path d="M28 30l20 20"/><path d="M42 44l6-6"/><path d="M36 38l6-6"/>'),
      S('F-6-5','Scan Iris','<circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="10"/><circle cx="32" cy="32" r="3"/><line x1="32" y1="8" x2="32" y2="12"/><line x1="32" y1="52" x2="32" y2="56"/>'),
      S('F-6-6','Shield Check','<path d="M32 8L12 18v14c0 14 20 22 20 22s20-8 20-22V18z"/><path d="M24 32l6 6 12-12"/>'),
      S('F-6-7','Privacy Mask','<rect x="8" y="18" width="48" height="28" rx="6"/><circle cx="24" cy="32" r="6"/><circle cx="40" cy="32" r="6"/><path d="M12 26h40"/>'),
      S('F-6-8','Lock Closed','<rect x="16" y="28" width="32" height="24" rx="4"/><path d="M22 28v-8a10 10 0 0 1 20 0v8"/><circle cx="32" cy="40" r="3"/><line x1="32" y1="43" x2="32" y2="47"/>'),
      S('F-6-9','Vault','<rect x="12" y="12" width="40" height="40" rx="4"/><circle cx="32" cy="32" r="10"/><circle cx="32" cy="32" r="3"/><line x1="32" y1="22" x2="32" y2="26"/><line x1="32" y1="38" x2="32" y2="42"/>'),
      S('F-6-10','Padlock Open','<rect x="20" y="32" width="24" height="18" rx="3"/><path d="M24 32v-10a8 8 0 0 1 16 0"/>'),
    ]
  },
  {
    key: 'code', name: 'Code', emoji: '💻',
    items: [
      S('F-7-1','Brackets','<path d="M22 14L8 32l14 18"/><path d="M42 14l14 18-14 18"/><line x1="36" y1="10" x2="28" y2="54"/>'),
      S('F-7-2','Terminal','<rect x="8" y="12" width="48" height="40" rx="4"/><path d="M16 28l10 8-10 8"/><line x1="32" y1="40" x2="44" y2="40"/>'),
      S('F-7-3','Git Branch','<circle cx="22" cy="16" r="4"/><circle cx="42" cy="16" r="4"/><circle cx="22" cy="48" r="4"/><line x1="22" y1="20" x2="22" y2="44"/><path d="M42 20c0 14-20 14-20 28"/>'),
      S('F-7-4','Bug','<ellipse cx="32" cy="34" rx="10" ry="12"/><path d="M22 28l-8-4"/><path d="M42 28l8-4"/><path d="M22 40l-8 4"/><path d="M42 40l8 4"/><line x1="22" y1="34" x2="14" y2="34"/><line x1="42" y1="34" x2="50" y2="34"/>'),
      S('F-7-5','Cursor','<path d="M16 10v26l7-5 5 12 5-2-5-12 8 1z"/>'),
      S('F-7-6','API','<rect x="10" y="10" width="18" height="18" rx="3"/><rect x="36" y="10" width="18" height="18" rx="3"/><rect x="23" y="36" width="18" height="18" rx="3"/><line x1="28" y1="18" x2="36" y2="18"/><line x1="32" y1="28" x2="32" y2="36"/>'),
      S('F-7-7','Database','<ellipse cx="32" cy="16" rx="18" ry="7"/><path d="M14 16v16c0 4 8 7 18 7s18-3 18-7V16"/><path d="M14 26c0 4 8 7 18 7s18-3 18-7"/>'),
      S('F-7-8','Chip','<rect x="18" y="18" width="28" height="28" rx="3"/><line x1="26" y1="10" x2="26" y2="18"/><line x1="32" y1="10" x2="32" y2="18"/><line x1="38" y1="10" x2="38" y2="18"/><line x1="26" y1="46" x2="26" y2="54"/><line x1="32" y1="46" x2="32" y2="54"/><line x1="38" y1="46" x2="38" y2="54"/>'),
      S('F-7-9','JSON','<path d="M20 10c-6 0-8 4-8 8v6c0 4-4 5-4 8s4 4 4 8v6c0 4 2 8 8 8"/><path d="M44 10c6 0 8 4 8 8v6c0 4 4 5 4 8s-4 4-4 8v6c0 4-2 8-8 8"/>'),
      S('F-7-10','Hash','<line x1="24" y1="10" x2="20" y2="54"/><line x1="44" y1="10" x2="40" y2="54"/><line x1="12" y1="24" x2="52" y2="24"/><line x1="12" y1="40" x2="52" y2="40"/>'),
    ]
  },
  {
    key: 'globe', name: 'Globe', emoji: '🌍',
    items: [
      S('F-8-1','Globe Lines','<circle cx="32" cy="32" r="22"/><ellipse cx="32" cy="32" rx="9" ry="22"/><line x1="10" y1="32" x2="54" y2="32"/><path d="M14 20h36"/><path d="M14 44h36"/>'),
      S('F-8-2','Map Marker','<circle cx="32" cy="24" r="16"/><path d="M32 40v14"/><line x1="24" y1="54" x2="40" y2="54"/><circle cx="32" cy="24" r="5"/>'),
      S('F-8-3','Compass','<circle cx="32" cy="32" r="22"/><path d="M32 14v4"/><path d="M32 46v4"/><path d="M14 32h4"/><path d="M46 32h4"/><path d="M26 26l-4-4 14 10z" fill="currentColor" opacity="0.12"/><path d="M38 38l4 4-14-10z" fill="currentColor" opacity="0.12"/>'),
      S('F-8-4','Signal Tower','<line x1="32" y1="18" x2="32" y2="54"/><circle cx="32" cy="18" r="4"/><path d="M22 24a14 14 0 0 0 20 0"/><path d="M14 30a24 24 0 0 0 36 0"/>'),
      S('F-8-5','Flag','<line x1="14" y1="10" x2="14" y2="54"/><path d="M14 10h28l-6 8 6 8H14"/>'),
      S('F-8-6','Map','<rect x="8" y="12" width="48" height="40" rx="3"/><line x1="24" y1="12" x2="24" y2="52"/><line x1="40" y1="12" x2="40" y2="52"/>'),
      S('F-8-7','Flight Path','<circle cx="16" cy="46" r="4"/><circle cx="48" cy="18" r="4"/><path d="M20 44Q32 22 44 20" stroke-dasharray="4 3"/>'),
      S('F-8-8','Network','<circle cx="32" cy="16" r="4"/><circle cx="16" cy="42" r="4"/><circle cx="48" cy="42" r="4"/><line x1="32" y1="20" x2="16" y2="38"/><line x1="32" y1="20" x2="48" y2="38"/><line x1="20" y1="42" x2="44" y2="42"/>'),
      S('F-8-9','Language','<circle cx="32" cy="32" r="20"/><path d="M18 20h28"/><path d="M22 20l4 12"/><path d="M42 20l-4 12"/><line x1="20" y1="28" x2="44" y2="28"/>'),
      S('F-8-10','Route','<circle cx="16" cy="16" r="4"/><circle cx="48" cy="48" r="4"/><path d="M20 16h16a8 8 0 0 1 0 16H28a8 8 0 0 0 0 16h16"/>'),
    ]
  },
  {
    key: 'achievement', name: 'Achievement', emoji: '🏆',
    items: [
      S('F-9-1','Star','<path d="M32 6l7 14h16l-12 10 4 16-15-9-15 9 4-16L9 20h16z"/>'),
      S('F-9-2','Trophy','<path d="M22 12h20v14c0 8-10 12-10 12s-10-4-10-12V12z"/><path d="M22 18h-4c0 6 4 8 4 8M42 18h4c0 6-4 8-4 8"/><path d="M28 42h8"/><path d="M32 38v4"/><rect x="26" y="44" width="12" height="4" rx="2"/>'),
      S('F-9-3','Award','<circle cx="32" cy="24" r="14"/><path d="M22 36l-4 18 14-6 14 6-4-18"/><path d="M28 24l3 3 7-7"/>'),
      S('F-9-4','Heart','<path d="M32 50L16 34a10 10 0 0 1 0-14 10 10 0 0 1 16 0 10 10 0 0 1 16 0 10 10 0 0 1 0 14z"/>'),
      S('F-9-5','Flame','<path d="M32 8c8 12 16 20 16 28a16 16 0 0 1-32 0c0-8 8-16 16-28z"/><path d="M32 56c-4 0-8-4-8-10 0-6 8-12 8-12s8 6 8 12c0 6-4 10-8 10z"/>'),
      S('F-9-6','Crown','<path d="M10 42V24l8 8 14-16 14 16 8-8v18z"/><rect x="10" y="42" width="44" height="6" rx="2"/>'),
      S('F-9-7','Laurel','<circle cx="32" cy="24" r="10"/><path d="M32 34v14"/><path d="M20 48c0-8 4-14 12-14"/><path d="M44 48c0-8-4-14-12-14"/>'),
      S('F-9-8','Sparkle','<path d="M32 6l4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/><path d="M48 36l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>'),
      S('F-9-9','Verified','<circle cx="32" cy="32" r="18"/><path d="M24 32l6 6 12-12"/>'),
      S('F-9-10','Gem','<path d="M12 24h40l-20 30z"/><path d="M12 24l8-12h24l8 12"/><line x1="32" y1="12" x2="32" y2="54"/><line x1="20" y1="12" x2="12" y2="24"/><line x1="44" y1="12" x2="52" y2="24"/>'),
    ]
  },
  {
    key: 'action', name: 'Action', emoji: '🚀',
    items: [
      S('F-10-1','Takeoff','<path d="M8 46h48"/><path d="M16 46l8-14h16l8 14"/><path d="M32 32v-20"/><path d="M26 18l6-6 6 6"/>'),
      S('F-10-2','Checkmark','<circle cx="32" cy="32" r="22"/><path d="M22 32l7 7 14-14"/>'),
      S('F-10-3','Spark','<line x1="32" y1="6" x2="32" y2="16"/><line x1="32" y1="48" x2="32" y2="58"/><line x1="6" y1="32" x2="16" y2="32"/><line x1="48" y1="32" x2="58" y2="32"/><line x1="14" y1="14" x2="20" y2="20"/><line x1="44" y1="44" x2="50" y2="50"/><line x1="50" y1="14" x2="44" y2="20"/><line x1="20" y1="44" x2="14" y2="50"/>'),
      S('F-10-4','Arrow Up','<path d="M32 54V14"/><path d="M18 28l14-14 14 14"/>'),
      S('F-10-5','Play','<circle cx="32" cy="32" r="22"/><path d="M26 20v24l18-12z" fill="currentColor" opacity="0.12"/>'),
      S('F-10-6','Toggle On','<rect x="10" y="22" width="44" height="20" rx="10"/><circle cx="42" cy="32" r="7"/><path d="M22 30h8"/>'),
      S('F-10-7','Zap','<path d="M38 6L16 34h18L24 58l26-32H32z"/>'),
      S('F-10-8','Target','<circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="12"/><circle cx="32" cy="32" r="4"/>'),
      S('F-10-9','Paper Plane','<path d="M52 10L28 32"/><path d="M52 10L36 54l-8-22"/><path d="M52 10L8 28l20 4"/>'),
      S('F-10-10','Magic Stars','<path d="M32 6l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path d="M50 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M18 38l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/>'),
    ]
  },
];
