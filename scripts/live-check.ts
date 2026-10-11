const BASE = process.argv[2];
const secrets = [process.env.PH_TOKEN, process.env.GEMINI_API_KEY, process.env.DATABASE_URL].filter(Boolean) as string[];
const leak = (s: string) => secrets.some((v) => s.includes(v) || (v.length > 20 && s.includes(v.slice(0, 20))));

const t0 = Date.now();
const home = await fetch(BASE + "/");
const html = await home.text();
console.log(`home: HTTP ${home.status}, ${html.length} bytes, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
let leaked = leak(html);

const scripts = [...html.matchAll(/(?:src|href)="(\/_next\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
for (const s of new Set(scripts)) {
  const r = await fetch(BASE + s);
  const body = await r.text();
  if (leak(body)) { leaked = true; console.log("LEAK in", s); }
}
console.log(`assets checked: ${new Set(scripts).size}, secret found in page or scripts: ${leaked ? "YES" : "no"}`);

const t1 = Date.now();
const api = await fetch(BASE + "/api/launches", { cache: "no-store" });
const text = await api.text();
console.log(`/api/launches: HTTP ${api.status}, ${((Date.now() - t1) / 1000).toFixed(1)}s, secret in response: ${leak(text) ? "YES" : "no"}`);
try {
  const j = JSON.parse(text);
  console.log(`ranked items: ${j.items?.length}, filtered out: ${j.filteredOut?.length}, pending: ${j.pending}, last good run: ${j.run?.lastGoodAt}, latest status: ${j.run?.latestStatus}`);
  const top = j.items?.[0];
  console.log(`top: #${top?.rank} ${top?.name} | score ${top?.finalScore?.toFixed?.(1)} | angle: ${(top?.angle ?? "").slice(0, 80)}`);
} catch { console.log("could not parse:", text.slice(0, 200)); }
