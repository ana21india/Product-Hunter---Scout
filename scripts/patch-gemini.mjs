import fs from "node:fs";

const file = "src/lib/gemini.ts";
const src = fs.readFileSync(file, "utf8");
const start = src.indexOf("export type LaunchIn");
const end = src.indexOf("// One-line description and outreach angle");
if (start < 0 || end < 0) throw new Error("markers not found");

const block = `export type LaunchIn = { id: string; name: string; tagline: string | null; description: string | null; siteText?: string | null };

export type Verdict = { id: string; relevant: boolean; category: string; audience: string; serves: string; reason: string };

// The two-step relevance rule. Kavya looks for distribution partners: products whose customers are the same kind of people who would
// buy async standups. Step 1: does it fit one of the four areas? Step 2: who uses it day to day (A one person, B individual professionals
// inside a team workflow, C teams or managers)? Kept unless clearly personal or clearly outside the four areas.
export async function judgeRelevance(items: LaunchIn[]): Promise<Verdict[]> {
  const list = items
    .map((i) => {
      const site = i.siteText && i.siteText.length >= 300 ? i.siteText.replace(/\\n/g, " ") : "";
      return \`- id \${i.id} | \${i.name} | Product Hunt: \${clip(i.tagline, 160)} \${clip(i.description, 400)}\\n  Website: \${site || "not available or too short, so judge from the Product Hunt text and keep it if unclear"}\`;
    })
    .join("\\n\\n");
  const prompt = \`You screen new Product Hunt launches for a partnerships manager at a B2B SaaS company that sells async standups to remote teams. She looks for distribution partners: products whose CUSTOMERS are the same kind of people who would buy async standups, so the two products can integrate, bundle or promote each other. She is NOT selling standups to the launch's own staff.

Our customers are managers and team leads who run recurring check-ins for remote or distributed teams: engineering managers, product managers, scrum masters, project and program managers, founders and CTOs of remote-first companies, agency owners, people-ops leaders.

Step 1. Which area does the product fit? Project management (planning, tracking, coordinating team work); HR tech (hiring, onboarding, performance, engagement); Developer productivity (code review, git, testing, CI/CD, coding assistants, engineering analytics); Team communication (chat, meetings, async updates, shared knowledge). If none, category = "None".
Step 2. Who uses it day to day? audience = "A" one person for personal use (consumers, solo operators, students, job seekers, creators); "B" individual professionals working inside a team's workflow (for example developers reviewing teammates' code, recruiters in a hiring team); "C" teams or managers directly.
relevant = true when category is not "None" AND audience is B or C. relevant = false ONLY when the product is clearly personal (A), or clearly outside the four areas, or is a model, API or infrastructure bought by an individual developer to build something else. If the evidence is unclear, keep it (relevant = true).
Use the website text as the main evidence for who the customers are; the Product Hunt text may be short. Use only facts in the text given.
Return one entry per launch with the same id: relevant, category, audience, serves (who buys and uses it, at most six words), reason (one sentence, say what in the text shows it).

Launches:
\${list}\`;
  const schema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        id: { type: "STRING" },
        relevant: { type: "BOOLEAN" },
        category: { type: "STRING", enum: [...CATEGORIES, "None"] },
        audience: { type: "STRING", enum: ["A", "B", "C"] },
        serves: { type: "STRING" },
        reason: { type: "STRING" },
      },
      required: ["id", "relevant", "category", "audience", "serves", "reason"],
    },
  };
  return (await callJson(prompt, schema, { thinkingLevel: "low" })) as Verdict[];
}

`;
fs.writeFileSync(file, src.slice(0, start) + block + src.slice(end), "utf8");
console.log("gemini.ts patched");
