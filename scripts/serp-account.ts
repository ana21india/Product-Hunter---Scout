// Asks SerpAPI about the account behind the key (free, uses no searches). Never prints the key.
const key = process.env.SERPAPI_KEY ?? "";
console.log(`key length: ${key.length}, looks like hex: ${/^[0-9a-f]+$/i.test(key)}`);
for (const url of [
  `https://serpapi.com/account.json?api_key=${key}`,
  `https://serpapi.com/search.json?engine=google&q=test&num=1&api_key=${key}`,
]) {
  const r = await fetch(url);
  const text = (await r.text()).replace(key, "[key]");
  console.log(`\n${url.split("?")[0].replace("https://serpapi.com", "")} -> HTTP ${r.status}\n${text.slice(0, 400)}`);
}
