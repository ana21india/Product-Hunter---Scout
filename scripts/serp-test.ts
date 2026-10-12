import { searchLinkedInResults, pickProfile } from "../src/lib/serp";

const cases = [
  { founder: "Ishu Darshan", product: "Velozity", website: "https://getvelozity.com" },
  { founder: "Akash Mandal", product: "Velozity", website: "https://getvelozity.com" },
  { founder: "Dylan Field", product: "Figma", website: "https://www.figma.com" },
  { founder: "Yaniv Hayun", product: "Leanback", website: null },
];
for (const c of cases) {
  try {
    const results = await searchLinkedInResults(c.founder, c.product);
    const li = results.filter((r) => /linkedin\.com\/in\//i.test(r.link));
    const pick = pickProfile(results, c.founder, c.product, c.website);
    console.log(`\n${c.founder} (${c.product}): ${results.length} results, ${li.length} LinkedIn profiles`);
    for (const r of li.slice(0, 3)) console.log(`   - ${r.title.slice(0, 80)} | ${r.link}`);
    console.log(`   DECISION: ${pick.url ?? "nothing shown"}   (${pick.evidence.slice(0, 110)})`);
  } catch (e: any) {
    console.log(`\n${c.founder}: error ${e.message}`);
  }
}
