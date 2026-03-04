import type { SvgCategory } from './index';
const S = (id: string, l: string, s: string) => ({ id, label: l, svg: s });

export const categories: SvgCategory[] = [
  {
    key: 'notifications', name: 'Notifications', emoji: '🔔',
    items: [
      S('F-11-1','Bell','<path d="M32 8a16 16 0 0 1 16 16v10l4 6H12l4-6V24a16 16 0 0 1 16-16z"/><path d="M26 48a6 6 0 0 0 12 0"/>'),
      S('F-11-2','Alert','<circle cx="32" cy="32" r="22"/><line x1="32" y1="20" x2="32" y2="36"/><circle cx="32" cy="44" r="2" fill="currentColor" opacity="0.3"/>'),
      S('F-11-3','Badge Count','<rect x="8" y="12" width="40" height="40" rx="6"/><circle cx="48" cy="14" r="10"/><line x1="18" y1="26" x2="38" y2="26"/><line x1="18" y1="34" x2="32" y2="34"/>'),
      S('F-11-4','Horn','<path d="M12 26h6l20-12v36L18 38h-6z"/><path d="M46 24a10 10 0 0 1 0 16"/><path d="M50 18a16 16 0 0 1 0 28"/>'),
      S('F-11-5','Envelope','<rect x="8" y="14" width="48" height="36" rx="4"/><path d="M8 14l24 18 24-18"/>'),
      S('F-11-6','Chat Bubble','<path d="M10 12h36a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H26l-10 8v-8h-6a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z"/>'),
      S('F-11-7','Toast','<rect x="6" y="22" width="52" height="20" rx="6"/><circle cx="18" cy="32" r="4"/><line x1="28" y1="28" x2="50" y2="28"/><line x1="28" y1="36" x2="44" y2="36"/>'),
      S('F-11-8','Exclamation','<path d="M32 6L6 54h52z"/><line x1="32" y1="24" x2="32" y2="38"/><circle cx="32" cy="46" r="2" fill="currentColor" opacity="0.3"/>'),
      S('F-11-9','Info Circle','<circle cx="32" cy="32" r="22"/><line x1="32" y1="28" x2="32" y2="44"/><circle cx="32" cy="20" r="2" fill="currentColor" opacity="0.3"/>'),
      S('F-11-10','Sound Wave','<path d="M12 28v8"/><path d="M20 22v20"/><path d="M28 18v28"/><path d="M36 22v20"/><path d="M44 26v12"/><path d="M52 28v8"/>'),
    ]
  },
  {
    key: 'charts', name: 'Charts', emoji: '📊',
    items: [
      S('F-12-1','Bar Chart','<rect x="10" y="32" width="8" height="20" rx="1"/><rect x="22" y="22" width="8" height="30" rx="1"/><rect x="34" y="14" width="8" height="38" rx="1"/><rect x="46" y="26" width="8" height="26" rx="1"/>'),
      S('F-12-2','Line Graph','<rect x="8" y="8" width="48" height="44" rx="3"/><path d="M14 44l10-14 8 8 10-16 10 6" fill="none"/>'),
      S('F-12-3','Segments','<circle cx="32" cy="32" r="20"/><line x1="32" y1="12" x2="32" y2="32"/><path d="M32 32l14 14"/><path d="M32 32L18 44"/>'),
      S('F-12-4','Ring Meter','<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="14"/><path d="M42 22l4-6"/><line x1="28" y1="32" x2="36" y2="32"/>'),
      S('F-12-5','Growth Arrow','<path d="M8 48l16-18 10 6 12-22"/><path d="M40 14h14v14"/>'),
      S('F-12-6','Gauge','<path d="M12 44a22 22 0 1 1 40 0"/><path d="M32 44l-8-18"/>'),
      S('F-12-7','Scatter','<rect x="8" y="8" width="48" height="44" rx="2"/><circle cx="18" cy="38" r="2.5"/><circle cx="26" cy="28" r="2.5"/><circle cx="34" cy="34" r="2.5"/><circle cx="42" cy="18" r="2.5"/><circle cx="48" cy="24" r="2.5"/>'),
      S('F-12-8','Area Chart','<rect x="8" y="8" width="48" height="44" rx="2"/><path d="M14 44l10-18 8 6 10-14 10 8V44z" fill="currentColor" opacity="0.08"/>'),
      S('F-12-9','Histogram','<rect x="12" y="36" width="6" height="16"/><rect x="20" y="28" width="6" height="24"/><rect x="28" y="16" width="6" height="36"/><rect x="36" y="24" width="6" height="28"/><rect x="44" y="32" width="6" height="20"/>'),
      S('F-12-10','Speedometer','<path d="M10 44a24 24 0 1 1 44 0"/><path d="M32 44l-6-20"/><circle cx="32" cy="44" r="3"/>'),
    ]
  },
  {
    key: 'collab', name: 'Collaboration', emoji: '👥',
    items: [
      S('F-13-1','People','<circle cx="22" cy="18" r="7"/><path d="M10 48v-6a12 12 0 0 1 24 0v6"/><circle cx="44" cy="22" r="5"/><path d="M38 48v-4a8 8 0 0 1 16 0v4"/>'),
      S('F-13-2','Chat','<path d="M8 12h32a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H20l-8 6v-6H8V12z"/><path d="M20 40h24a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-4v4l-6-4H20a4 4 0 0 1-4-4V44a4 4 0 0 1 4-4z" opacity="0.5"/>'),
      S('F-13-3','Share','<circle cx="44" cy="16" r="6"/><circle cx="12" cy="32" r="6"/><circle cx="44" cy="48" r="6"/><line x1="18" y1="29" x2="38" y2="19"/><line x1="18" y1="35" x2="38" y2="45"/>'),
      S('F-13-4','High Five','<path d="M14 32h8V20h-8z"/><path d="M22 32h20V20H22z"/><path d="M42 32h8V20h-8z"/><path d="M18 32v14"/><path d="M32 32v14"/><path d="M46 32v14"/>'),
      S('F-13-5','Team','<circle cx="32" cy="14" r="6"/><circle cx="16" cy="22" r="5"/><circle cx="48" cy="22" r="5"/><path d="M22 48v-8a10 10 0 0 1 20 0v8"/><path d="M10 46v-6a6 6 0 0 1 12 0"/><path d="M42 46v-6a6 6 0 0 1 12 0"/>'),
      S('F-13-6','Video Call','<rect x="8" y="16" width="36" height="28" rx="4"/><path d="M44 24l12-6v24l-12-6z"/>'),
      S('F-13-7','At Sign','<circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="8"/><path d="M40 32v4a4 4 0 0 0 8 0v-4"/>'),
      S('F-13-8','Comment','<rect x="10" y="10" width="44" height="30" rx="4"/><path d="M20 40v10l10-10"/><line x1="18" y1="22" x2="46" y2="22"/><line x1="18" y1="30" x2="38" y2="30"/>'),
      S('F-13-9','Group Add','<circle cx="24" cy="20" r="7"/><path d="M12 48v-6a12 12 0 0 1 24 0v6"/><line x1="48" y1="24" x2="48" y2="38"/><line x1="41" y1="31" x2="55" y2="31"/>'),
      S('F-13-10','Users Plus','<circle cx="22" cy="18" r="6"/><path d="M10 44v-4a12 12 0 0 1 24 0v4"/><circle cx="42" cy="18" r="6"/><path d="M50 28v8"/><path d="M46 32h8"/>'),
    ]
  },
  {
    key: 'settings', name: 'Settings', emoji: '⚙️',
    items: [
      S('F-14-1','Gear','<circle cx="32" cy="32" r="10"/><path d="M32 6v6M32 52v6M6 32h6M52 32h6M13 13l4 4M47 47l4 4M47 13l-4 4M13 47l4 4"/>'),
      S('F-14-2','Equalizer','<rect x="14" y="28" width="6" height="22" rx="2"/><rect x="24" y="14" width="6" height="36" rx="2"/><rect x="34" y="22" width="6" height="28" rx="2"/><rect x="44" y="18" width="6" height="32" rx="2"/>'),
      S('F-14-3','Toggle','<rect x="8" y="22" width="48" height="20" rx="10"/><circle cx="42" cy="32" r="7"/>'),
      S('F-14-4','Hammer','<path d="M24 28L16 46"/><rect x="12" y="44" width="10" height="6" rx="2" transform="rotate(-30 17 47)"/><rect x="24" y="12" width="20" height="12" rx="3"/><path d="M34 24v6"/>'),
      S('F-14-5','Sort Lines','<line x1="12" y1="16" x2="38" y2="16"/><line x1="12" y1="26" x2="32" y2="26"/><line x1="12" y1="36" x2="26" y2="36"/><line x1="12" y1="46" x2="20" y2="46"/><path d="M46 22v28"/><path d="M40 44l6 6 6-6"/>'),
      S('F-14-6','Controls','<rect x="8" y="14" width="48" height="36" rx="4"/><circle cx="22" cy="26" r="4"/><circle cx="42" cy="38" r="4"/><line x1="8" y1="26" x2="18" y2="26"/><line x1="26" y1="26" x2="56" y2="26"/><line x1="8" y1="38" x2="38" y2="38"/><line x1="46" y1="38" x2="56" y2="38"/>'),
      S('F-14-7','Palette','<circle cx="32" cy="32" r="22"/><circle cx="22" cy="24" r="3"/><circle cx="36" cy="18" r="3"/><circle cx="44" cy="28" r="3"/><circle cx="40" cy="40" r="3"/>'),
      S('F-14-8','Panel','<rect x="8" y="8" width="48" height="48" rx="4"/><line x1="8" y1="22" x2="56" y2="22"/><circle cx="18" cy="15" r="2"/><circle cx="26" cy="15" r="2"/><circle cx="34" cy="15" r="2"/><line x1="16" y1="32" x2="40" y2="32"/><line x1="16" y1="40" x2="32" y2="40"/>'),
      S('F-14-9','Switch','<rect x="12" y="14" width="40" height="16" rx="8"/><circle cx="40" cy="22" r="5"/><rect x="12" y="36" width="40" height="16" rx="8"/><circle cx="24" cy="44" r="5"/>'),
      S('F-14-10','Cog Wheel','<circle cx="32" cy="32" r="8"/><path d="M32 8v8M32 48v8M8 32h8M48 32h8"/><path d="M15 15l6 6M43 43l6 6M49 15l-6 6M15 49l6-6"/>'),
    ]
  },
  {
    key: 'media', name: 'Media', emoji: '🖼️',
    items: [
      S('F-15-1','Image','<rect x="8" y="12" width="48" height="40" rx="4"/><circle cx="22" cy="26" r="5"/><path d="M8 44l14-12 8 8 12-10 14 12"/>'),
      S('F-15-2','Video','<rect x="8" y="14" width="48" height="36" rx="4"/><path d="M28 24v16l14-8z" fill="currentColor" opacity="0.12"/>'),
      S('F-15-3','Camera','<rect x="8" y="18" width="48" height="34" rx="4"/><path d="M22 18l2-6h16l2 6"/><circle cx="32" cy="36" r="10"/><circle cx="32" cy="36" r="4"/>'),
      S('F-15-4','Music Note','<path d="M24 44V16l24-6v28"/><circle cx="20" cy="44" r="6"/><circle cx="44" cy="38" r="6"/>'),
      S('F-15-5','Mic','<rect x="24" y="8" width="16" height="26" rx="8"/><path d="M16 30a16 16 0 0 0 32 0"/><line x1="32" y1="46" x2="32" y2="54"/><line x1="24" y1="54" x2="40" y2="54"/>'),
      S('F-15-6','Gallery','<rect x="6" y="14" width="28" height="22" rx="3"/><rect x="22" y="24" width="28" height="22" rx="3"/><circle cx="18" cy="24" r="3"/>'),
      S('F-15-7','Clapperboard','<rect x="8" y="18" width="48" height="36" rx="3"/><path d="M8 18l12-8 10 8"/><path d="M30 10l10 8h14V18H30z"/>'),
      S('F-15-8','Aspect Ratio','<rect x="8" y="12" width="48" height="40" rx="4"/><rect x="12" y="16" width="24" height="18" rx="2"/><path d="M14 30l6-4v8z"/>'),
      S('F-15-9','Volume','<path d="M12 24h8l12-10v36L20 40H12z"/><path d="M38 24a8 8 0 0 1 0 16"/><path d="M42 18a14 14 0 0 1 0 28"/>'),
      S('F-15-10','Screen','<rect x="6" y="10" width="52" height="36" rx="4"/><line x1="24" y1="52" x2="40" y2="52"/><line x1="32" y1="46" x2="32" y2="52"/>'),
    ]
  },
];
