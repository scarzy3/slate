const DARK = {
  bg:"#06070a",panel:"#0c0d11",card:"rgba(255,255,255,0.022)",
  cardH:"rgba(255,255,255,0.045)",bd:"rgba(255,255,255,0.055)",
  bdH:"rgba(255,255,255,0.13)",tx:"#e4e4e7",sub:"#a1a1aa",
  mu:"#71717a",dm:"#3f3f46",bl:"#60a5fa",ind:"#818cf8",
  pu:"#a78bfa",gn:"#4ade80",rd:"#f87171",am:"#fbbf24",
  tl:"#2dd4bf",pk:"#f472b6",or:"#fb923c",cy:"#22d3ee",
  m:"'IBM Plex Mono',monospace",u:"'Outfit',sans-serif",
  _scrollThumb:"rgba(255,255,255,.07)",_optBg:"#16171b",_optColor:"#e4e4e7",
  _selBg:"rgba(96,165,250,.3)",_isDark:true,
};
const LIGHT = {
  bg:"#f4f5f7",panel:"#ffffff",card:"rgba(0,0,0,0.025)",
  cardH:"rgba(0,0,0,0.055)",bd:"rgba(0,0,0,0.1)",
  bdH:"rgba(0,0,0,0.18)",tx:"#18181b",sub:"#52525b",
  mu:"#71717a",dm:"#a1a1aa",bl:"#2563eb",ind:"#6366f1",
  pu:"#7c3aed",gn:"#16a34a",rd:"#dc2626",am:"#d97706",
  tl:"#0d9488",pk:"#db2777",or:"#ea580c",cy:"#0891b2",
  m:"'IBM Plex Mono',monospace",u:"'Outfit',sans-serif",
  _scrollThumb:"rgba(0,0,0,.12)",_optBg:"#ffffff",_optColor:"#18181b",
  _selBg:"rgba(37,99,235,.2)",_isDark:false,
};
let T = (localStorage.getItem("slate_theme")==="light") ? {...LIGHT} : {...DARK};
function applyTheme(dark){const src=dark?DARK:LIGHT;Object.assign(T,src);
  localStorage.setItem("slate_theme",dark?"dark":"light");
  document.body.style.background=T.bg;document.body.style.color=T.tx;}
const CM={
  /* Solid Colors */
  BLACK:"#27272a",WHITE:"#E2E8F0",SILVER:"#94a3b8",GRAY:"#6b7280",
  RED:"#DC2626",CRIMSON:"#be123c",MAROON:"#7f1d1d",CORAL:"#f97316",
  ORANGE:"#EA7317",AMBER:"#f59e0b",GOLD:"#ca8a04",YELLOW:"#EAB308",
  LIME:"#84cc16",GREEN:"#22C55E",EMERALD:"#10b981",TEAL:"#14b8a6",
  CYAN:"#06b6d4",SKY:"#0ea5e9",BLUE:"#3B82F6",NAVY:"#1e3a5f",
  INDIGO:"#6366f1",PURPLE:"#8B5CF6",VIOLET:"#7c3aed",FUCHSIA:"#d946ef",
  PINK:"#E91E8C",ROSE:"#f43f5e",BROWN:"#7c3a12",OLIVE:"#4d7c0f",
  /* Numbered - for large fleets */
  "001":"#3B82F6","002":"#22C55E","003":"#DC2626","004":"#EAB308","005":"#8B5CF6",
  "006":"#14b8a6","007":"#f97316","008":"#E91E8C","009":"#6366f1","010":"#84cc16",
  "011":"#0ea5e9","012":"#f43f5e","013":"#ca8a04","014":"#06b6d4","015":"#d946ef",
  "016":"#10b981","017":"#7c3aed","018":"#f59e0b","019":"#be123c","020":"#94a3b8",
  /* Patterns */
  CHECKER:"repeating-conic-gradient(#1a1a1a 0% 25%,#e2e8f0 0% 50%) 50%/12px 12px",
  RWB:"linear-gradient(180deg,#DC2626 33%,#fff 33% 66%,#3B82F6 66%)",
  STRIPES:"repeating-linear-gradient(45deg,#27272a,#27272a 4px,#fbbf24 4px,#fbbf24 8px)",
};

export { DARK, LIGHT, T, applyTheme, CM };
