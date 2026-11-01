const THEMES: Record<string, { from: string; to: string; ink: string; glyph: string }> = {
  "Design & Canva": { from: "#F9E9D6", to: "#F2D3B4", ink: "#8A4E1C", glyph: "Aa" },
  Spreadsheets: { from: "#E3F0E3", to: "#CBE3CE", ink: "#24633D", glyph: "⊞" },
  "Data & Python": { from: "#E4EAF7", to: "#CCD8F0", ink: "#2C4479", glyph: "λ" },
  "Web development": { from: "#F2E6F2", to: "#E2CFE4", ink: "#69356B", glyph: "</>" },
  "AI tools": { from: "#E7EEE9", to: "#CFE0D5", ink: "#1F5B45", glyph: "✦" },
  "Video & content": { from: "#E6EEF3", to: "#CFE0EA", ink: "#2A566E", glyph: "▶" },
  "Marketing & social": { from: "#FBEBDD", to: "#F6D6BE", ink: "#8C4A16", glyph: "#" },
  "Career & productivity": { from: "#ECEAF7", to: "#DAD6EE", ink: "#463D86", glyph: "◎" },
  Other: { from: "#EEEDE7", to: "#DFDDD2", ink: "#55544A", glyph: "•" },
};

export function categoryTheme(category: string) {
  return THEMES[category] ?? THEMES.Other;
}
