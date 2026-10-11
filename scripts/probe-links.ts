import { q } from "../src/lib/db";
import * as PH from "../src/lib/ph";
PH.budget.mode = "wait";
const t: any = await PH.ph(`{ __type(name:"ProductLink"){ fields{ name } } }`).catch(() => null);
console.log("ProductLink fields:", t?.__type?.fields?.map((f: any) => f.name).join(", "));
const rows = await q(`SELECT l.post_id id, l.name FROM launches l JOIN relevance r USING(post_id) WHERE r.relevant ORDER BY l.votes_count DESC LIMIT 12`);
const body = rows.map((r: any, i: number) => `p${i}: post(id:"${r.id}"){ productLinks{ type url } makers{ id name username websiteUrl twitterUsername url } }`).join(" ");
const d: any = await PH.ph(`{ ${body} }`);
rows.forEach((r: any, i: number) => {
  const p = d[`p${i}`];
  console.log("\n" + r.name);
  console.log("  productLinks:", JSON.stringify(p.productLinks?.map((l: any) => l.type + " " + l.url)));
  for (const m of p.makers) console.log("  maker:", m.name, "| website:", m.websiteUrl, "| twitter:", m.twitterUsername);
});

