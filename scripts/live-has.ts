const BASE = process.argv[2];
const needle = process.argv[3];
for (let i = 1; i <= 15; i++) {
  const html = await (await fetch(BASE + "/", { cache: "no-store" })).text();
  const scripts = [...new Set([...html.matchAll(/(\/_next\/[^"]+\.js)/g)].map((m) => m[1]))];
  let found = false;
  for (const s of scripts) if ((await (await fetch(BASE + s)).text()).includes(needle)) { found = true; break; }
  console.log(`check ${i}: new version live = ${found}`);
  if (found) break;
  await new Promise((r) => setTimeout(r, 20000));
}
