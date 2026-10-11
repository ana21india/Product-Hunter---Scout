import { findLinkedIn } from "../src/lib/gemini";

const cases = [
  { founder: "Dylan Field", product: "Figma Agent", tagline: "Prompt, edit and prototype without leaving the canvas", website: "https://www.figma.com" },
  { founder: "Brendan O'Driscoll", product: "Figma Agent", tagline: "Prompt, edit and prototype without leaving the canvas", website: "https://www.figma.com" },
  { founder: "Michael Chen", product: "Acme Analytics", tagline: "Analytics for teams", website: null },
  { founder: "Yaniv Hayun", product: "Leanback", tagline: "AI assistant for engineering managers", website: null },
  { founder: "Fer Flores", product: "Cairo AI", tagline: "Workforce analytics and skills intelligence", website: null },
  { founder: "lmanchu", product: "IrisGo", tagline: "", website: null },
];
for (const c of cases) {
  try {
    const r = await findLinkedIn(c);
    console.log(`${c.founder} (${c.product}) -> ${r.url ?? "nothing kept"}   | evidence: ${r.evidence.replace(/\s+/g, " ").slice(0, 140)}`);
  } catch (e: any) {
    console.log(`${c.founder}: error ${e.message}`);
  }
}

