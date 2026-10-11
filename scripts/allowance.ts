const r = await fetch("https://api.producthunt.com/v2/api/graphql", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.PH_TOKEN}` },
  body: JSON.stringify({ query: "{ viewer { user { id } } }" }),
});
const body = await r.text();
console.log("HTTP", r.status, "| remaining:", r.headers.get("x-rate-limit-remaining"), "| limit:", r.headers.get("x-rate-limit-limit"), "| reset in (s):", r.headers.get("x-rate-limit-reset"));
console.log(body.slice(0, 200));
