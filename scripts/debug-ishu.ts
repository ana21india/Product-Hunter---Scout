const prompts = [
  `Use Google Search to find the LinkedIn profile of Ishu Darshan, a founder or maker of the product "Velozity". List every linkedin.com/in/ profile you find that could belong to a person with this name. Reply with one line per profile: PROFILE: <address> | <headline>. If none, reply NONE.`,
  `Find the LinkedIn profile for Ishu Darshan, co-founder of Velozity. Search: site:linkedin.com/in "Ishu Darshan". Reply with the profile address(es) and the headline shown.`,
];
for (const text of prompts) {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY as string },
    body: JSON.stringify({ contents: [{ parts: [{ text }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.1 } }),
  });
  const j: any = await r.json();
  const c = j.candidates?.[0];
  console.log("\nPROMPT:", text.slice(0, 80));
  console.log("ANSWER:", JSON.stringify(c?.content?.parts?.map((p: any) => p.text)).slice(0, 500));
  console.log("SEARCH QUERIES USED:", JSON.stringify(c?.groundingMetadata?.webSearchQueries));
  console.log("SOURCES:", JSON.stringify((c?.groundingMetadata?.groundingChunks ?? []).map((g: any) => g.web?.title)).slice(0, 400));
}
