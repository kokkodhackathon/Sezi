// Pilot alandaki eserlerin slug listesi: eser sayfası "Buraya rota planla" düğmesini bununla gösterir.
// Sunucu paketine 470 KB'lık grafiği almamak için derlemeden önce üretilir (predev / prebuild); grafik değişince yeniden üretilir.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const graph = JSON.parse(readFileSync(join(root, "../mobile/assets/pilot/bursa-hanlar-nav.json"), "utf8"));
const slugs = [...new Set(graph.nodes.flatMap((n) => (typeof n.workSlug === "string" ? [n.workSlug] : [])))].sort();

const out = `// Üretildi: scripts/pilot-slugs.mjs (gömülü pilot grafiği). Elle düzenlemeyin.
export const PILOT_SLUGS: ReadonlySet<string> = new Set(${JSON.stringify(slugs, null, 2)});
`;
writeFileSync(join(root, "src/lib/pilot-slugs.ts"), out);
console.log(`pilot-slugs: ${slugs.length} eser`);
