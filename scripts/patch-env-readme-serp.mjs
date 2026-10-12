import fs from "node:fs";

{
  const f = ".env.example";
  let s = fs.readFileSync(f, "utf8");
  if (!s.includes("SERPAPI_KEY")) s = s.replace(/\s*$/, "\n# Optional: a SerpAPI key turns on founder LinkedIn lookups through a real search service\nSERPAPI_KEY=\n");
  fs.writeFileSync(f, s, "utf8");
  console.log("env example updated");
}
{
  const f = "README.md";
  let s = fs.readFileSync(f, "utf8");
  function rep(from, to) { if (!s.includes(from)) throw new Error("not found: " + from.slice(0, 70)); s = s.replace(from, to); }
  rep(
    "   - `GEMINI_API_KEY` is your Gemini API key.",
    "   - `GEMINI_API_KEY` is your Gemini API key.\n   - `SERPAPI_KEY` (optional) is a SerpAPI key. With it, founders' LinkedIn profiles are looked up through a real search service; without it, Gemini's own search is used, which rarely finds LinkedIn pages.",
  );
  fs.writeFileSync(f, s, "utf8");
  console.log("README updated");
}
