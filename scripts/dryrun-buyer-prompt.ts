import { q } from "../src/lib/db";

// Dry run: tries the proposed buyer-centred relevance prompt on real launches. Nothing is written to the database.
const names = [
  "Velozity", "Rill Browser", "OpenSwarm", "Busabase", "CodeCrab", "GitGlow", "EdgeX11", "Fyka Retro", "Hirevire", "PPM Compass 360", "PTO Manager", "Noted",
  "IrisGo for Solopreneurs", "Onepin", "Web Search API", "AUDR by Chargebee", "Liquid Inference", "Cue", "Coddy", "ParakeetAI 2.0", "Zernio", "Pine Computer",
];
const rows = await q(
  `SELECT l.post_id AS id, l.name, l.tagline, l.description, l.url, l.votes_count v, r.relevant AS was, r.reason AS was_reason
   FROM launches l JOIN relevance r USING(post_id) WHERE l.name = ANY($1::text[]) AND l.created_at > now() - interval '7 days'`,
  [names],
);

const prompt = `You screen new Product Hunt launches for a partnerships manager at a B2B SaaS company that sells async standups to remote teams.

Our customers are managers and team leads who run recurring check-ins for remote or distributed teams of roughly 5 to 200 people, and who lose time and attention to live standups: engineering managers, product managers, scrum masters, project and program managers, founders and CTOs of remote-first companies, agency owners, and people-ops leaders at distributed companies.

For each launch, work out who buys it and who uses it every day.
Mark relevant = true when BOTH are true:
  1. Its buyers or daily users are those same managers, leads or their teams (so a partnership could reach our customers), or it holds the work status a standup would report (tasks, pull requests, hiring pipeline, team messages).
  2. It fits one of: Project management (planning, tracking, coordinating team work), HR tech (hiring, onboarding, performance, engagement), Developer productivity (code review, git, testing, CI/CD, coding assistants, engineering analytics), Team communication (chat, meetings, async updates, shared knowledge).
Mark relevant = false when the buyer is an individual, a solo operator, a consumer, a student or job seeker, a creator or media team; or when it is a model, API or infrastructure bought by an individual developer to build something else.
If the text is unclear but it could plausibly serve team leads, keep it (relevant = true).
Return one entry per launch with the same id: relevant, category (best fit of the four areas, or "None"), serves (who buys and uses it, at most five words), reason (one sentence using only the text given).

Launches:
${rows.map((r: any) => `- id ${r.id} | ${r.name} | ${(r.tagline ?? "").slice(0, 160)} | ${(r.description ?? "").replace(/\s+/g, " ").slice(0, 400)}`).join("\n")}`;

const schema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: { id: { type: "STRING" }, relevant: { type: "BOOLEAN" }, category: { type: "STRING" }, serves: { type: "STRING" }, reason: { type: "STRING" } },
    required: ["id", "relevant", "category", "serves", "reason"],
  },
};
const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY as string },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingLevel: "low" } },
  }),
});
const j: any = await r.json();
const out = JSON.parse(j.candidates[0].content.parts.map((p: any) => p.text ?? "").join(""));
const byId = new Map(out.map((o: any) => [o.id, o]));
for (const row of rows) {
  const o: any = byId.get(row.id);
  const link = String(row.url).split("?")[0];
  console.log(`${o?.relevant ? "KEEP" : "DROP"} (was ${row.was ? "keep" : "drop"}) | ${row.name} | ${row.v} upvotes | ${link}\n     serves: ${o?.serves} | category: ${o?.category}\n     why: ${o?.reason}`);
}
