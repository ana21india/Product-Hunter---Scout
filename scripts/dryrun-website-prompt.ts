import { q } from "../src/lib/db";

// Dry run of the proposed two-step rule WITH the product's own website text. Nothing is written to the database.
const names = ["CodeCrab", "GitGlow", "Rill Browser", "IrisGo for Solopreneurs", "OpenSwarm", "Onepin", "Velozity", "Web Search API", "Cue", "Fyka Retro"];
const rows = await q(
  `SELECT l.post_id AS id, l.name, l.tagline, l.description, l.website, l.url, l.votes_count v, r.relevant AS was, r.reason AS was_reason
   FROM launches l JOIN relevance r USING(post_id) WHERE l.name = ANY($1::text[]) AND l.created_at > now() - interval '7 days'`,
  [names],
);

async function siteText(url: string | null) {
  if (!url) return { text: "", status: "no website" };
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; PartnershipScout/1.0)" }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return { text: "", status: `HTTP ${r.status}` };
    const html = await r.text();
    const strip = (s: string) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/&nbsp;|&amp;|&#\d+;/g, " ").replace(/\s+/g, " ").trim();
    const title = strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const meta = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i)?.[1] ?? "";
    const heads = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => strip(m[1])).filter((t) => t.length > 3).slice(0, 14);
    const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => strip(m[1])).filter((t) => t.length > 40).slice(0, 5);
    const text = [`Title: ${title}`, meta && `Description: ${meta}`, heads.length && `Headings: ${heads.join(" | ")}`, paras.length && `Text: ${paras.join(" ")}`].filter(Boolean).join("\n").slice(0, 1800);
    return { text, status: "ok" };
  } catch (e: any) {
    return { text: "", status: "fetch failed" };
  }
}

const sites = await Promise.all(rows.map((r: any) => siteText(r.website)));
const items = rows.map((r: any, i: number) => `- id ${r.id} | ${r.name} | Product Hunt: ${(r.tagline ?? "")} ${(r.description ?? "").replace(/\s+/g, " ").slice(0, 400)}\n  Website (${sites[i].status}): ${sites[i].text.replace(/\n/g, " ")}`).join("\n\n");

const prompt = `You screen new Product Hunt launches for a partnerships manager at a B2B SaaS company that sells async standups to remote teams. She looks for distribution partners: products whose CUSTOMERS are the same kind of people who would buy async standups, so the two products can integrate, bundle or promote each other. She is NOT selling standups to the launch's own staff.

Our customers are managers and team leads who run recurring check-ins for remote or distributed teams: engineering managers, product managers, scrum masters, project and program managers, founders and CTOs of remote-first companies, agency owners, people-ops leaders.

Step 1. Which area does the product fit? Project management (planning, tracking, coordinating team work); HR tech (hiring, onboarding, performance, engagement); Developer productivity (code review, git, testing, CI/CD, coding assistants, engineering analytics); Team communication (chat, meetings, async updates, shared knowledge). If none, category = "None".
Step 2. Who uses it day to day? audience = "A" one person for personal use (consumers, solo operators, students, job seekers, creators); "B" individual professionals working inside a team's workflow (for example developers reviewing teammates' code, recruiters in a hiring team); "C" teams or managers directly.
relevant = true when category is not "None" AND audience is B or C. relevant = false ONLY when the product is clearly personal (A), or clearly outside the four areas, or is a model, API or infrastructure bought by an individual developer to build something else. If the evidence is unclear, keep it (relevant = true).
Use the website text as the main evidence for who the customers are; the Product Hunt text may be short. Use only facts in the text given.
Return one entry per launch with the same id: relevant, category, audience, serves (who buys and uses it, at most six words), reason (one sentence, say what in the text shows it).

Launches:
${items}`;

const schema = {
  type: "ARRAY",
  items: { type: "OBJECT", properties: { id: { type: "STRING" }, relevant: { type: "BOOLEAN" }, category: { type: "STRING" }, audience: { type: "STRING" }, serves: { type: "STRING" }, reason: { type: "STRING" } }, required: ["id", "relevant", "category", "audience", "serves", "reason"] },
};
const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY as string },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingLevel: "low" } } }),
});
const j: any = await r.json();
const out = JSON.parse(j.candidates[0].content.parts.map((p: any) => p.text ?? "").join(""));
const byId = new Map(out.map((o: any) => [o.id, o]));
rows.forEach((row: any, i: number) => {
  const o: any = byId.get(row.id);
  console.log(`\n${row.name} (${row.v} upvotes) | website read: ${sites[i].status}, ${sites[i].text.length} chars`);
  console.log(`   BEFORE: ${row.was ? "kept" : "filtered out"} | ${row.was_reason}`);
  console.log(`   AFTER:  ${o?.relevant ? "KEPT" : "FILTERED OUT"} | audience ${o?.audience} | area: ${o?.category} | serves: ${o?.serves}`);
  console.log(`           why: ${o?.reason}`);
});
