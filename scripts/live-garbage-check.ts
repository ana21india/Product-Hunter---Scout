const BASE = process.argv[2];
async function scan() {
  const html = await (await fetch(BASE + "/", { cache: "no-store" })).text();
  const scripts = [...new Set([...html.matchAll(/(\/_next\/[^"]+\.js)/g)].map((m) => m[1]))];
  let bad = 0, good = 0;
  for (const s of scripts) {
    const t = await (await fetch(BASE + s)).text();
    bad += (t.match(/Â·|â€|Ã—|Ã·/g) ?? []).length;
    good += (t.match(/·|…|×/g) ?? []).length;
  }
  return { bad, good };
}
for (let i = 1; i <= 12; i++) {
  const r = await scan();
  console.log(`check ${i}: garbled sequences ${r.bad}, correct symbols ${r.good}`);
  if (r.bad === 0 && r.good > 0) { console.log("LIVE SITE IS CLEAN"); break; }
  await new Promise((r) => setTimeout(r, 20000));
}
