import fs from "node:fs";

function load(file) {
  const raw = fs.readFileSync(file, "utf8");
  return { eol: raw.includes("\r\n") ? "\r\n" : "\n", raw };
}
function edit(file, fn) {
  const { raw } = load(file);
  const out = fn(raw);
  fs.writeFileSync(file, out, "utf8");
  console.log("patched", file);
}
const must = (s, from) => { if (!s.includes(from)) throw new Error("not found: " + from.slice(0, 90)); };
const rep = (s, from, to) => { must(s, from); return s.split(from).join(to); };

// ---- scoring.ts ----
edit("src/lib/scoring.ts", (s) => {
  const a = s.indexOf("// Qualification:");
  const bLine = s.indexOf("export const qualifies");
  if (a < 0 || bLine < 0) throw new Error("qualification block not found");
  const bEnd = s.indexOf("\n", bLine);
  const block = [
    "// Qualification: a launch is ranked unless it is clearly inactive.",
    "// A launch under FRESH_HOURS old is always ranked: it has had no time to build traction, and its makers may not have posted yet.",
    "// An older launch is ranked once its makers have written at least MIN_MAKER_COMMENTS comment (the usual intro post counts),",
    "// which leaves out launches whose makers never showed up (for example large companies that do not reply).",
    "// Launches that are not ranked stay visible on the Watchlist and are re-checked on every run. There is no upvote floor.",
    "export const MIN_MAKER_COMMENTS = 1;",
    "export const FRESH_HOURS = 24;",
    "export const qualifies = (r: { votes: number; makerComments: number; createdAt: string | Date }, now: Date = new Date()) =>",
    "  (now.getTime() - new Date(r.createdAt).getTime()) / 36e5 < FRESH_HOURS || r.makerComments >= MIN_MAKER_COMMENTS;",
  ].join("\n");
  return s.slice(0, a) + block + s.slice(bEnd);
});

// ---- data.ts ----
edit("src/lib/data.ts", (s) => {
  s = rep(s, "qualifies, MIN_MAKER_COMMENTS, MIN_UPVOTES }", "qualifies, MIN_MAKER_COMMENTS, FRESH_HOURS }");
  s = rep(s, "thresholds: { minMaker: number; minVotes: number }", "thresholds: { minMaker: number; freshHours: number }");
  s = rep(s, "qualifies({ votes: r.votes_count, makerComments: r.maker_comment_count })", "qualifies({ votes: r.votes_count, makerComments: r.maker_comment_count, createdAt: r.created_at })");
  const a = s.indexOf('    if (r.maker_comment_count === 0) reasons.push("Makers have not commented yet");');
  const b = s.indexOf("Under ${MIN_UPVOTES} upvotes so far`);");
  if (a < 0 || b < 0) throw new Error("reasons block not found");
  const bEnd = s.indexOf("\n", b);
  s = s.slice(0, a) + '    if (r.maker_comment_count < MIN_MAKER_COMMENTS) reasons.push("The makers have not commented on their launch");' + s.slice(bEnd);
  s = rep(s, "thresholds: { minMaker: MIN_MAKER_COMMENTS, minVotes: MIN_UPVOTES }", "thresholds: { minMaker: MIN_MAKER_COMMENTS, freshHours: FRESH_HOURS }");
  return s;
});

// ---- page.tsx ----
edit("src/app/page.tsx", (s) => {
  s = rep(s, "{ minMaker: 2, minVotes: 10 }", "{ minMaker: 1, freshHours: 24 }");
  s = rep(s, "A launch qualifies when its makers have written at least {th.minMaker} comments and it has at least {th.minVotes} upvotes.", "Launches under {th.freshHours} hours old are always ranked. Older launches are ranked once their makers have commented on their launch.");
  s = rep(s, "but they do not qualify for the ranking yet: makers need at least {th.minMaker} comments and the launch needs at least {th.minVotes} upvotes. Each run checks them again, and a launch moves up as soon as it qualifies.", "but they are not ranked: their makers have not commented on the launch, and it is more than {th.freshHours} hours old. Each run checks them again, and a launch moves up as soon as its makers comment.");
  s = rep(s, "<strong>Qualifies:</strong> the makers have written at least {th.minMaker} comments or replies (more than the usual intro post) and the launch has at least {th.minVotes} upvotes. Others wait on the Watchlist and are re-checked on every run.", "<strong>Ranked:</strong> every launch under {th.freshHours} hours old, since it has had no time to build traction. Older launches are ranked once their makers have commented on their launch, and the usual intro post counts. Launches whose makers never commented wait on the Watchlist and are re-checked on every run. There is no minimum number of upvotes.");
  // clearer wording for the "Replies" tile
  s = rep(s, '<div className="tlabel">Replies</div>', '<div className="tlabel">Founders replied</div>');
  s = rep(s, '{replyRate === null ? "no outreach yet" : `${replyRate}% reply rate`}', '{contactedAll.length === 0 ? "no outreach yet" : `${replyRate}% of the ${contactedAll.length} you contacted`}');
  s = rep(s, "aria-label={`Replies: ${repliedAll.length}. Open the Outreach tab`}", "aria-label={`Founders replied: ${repliedAll.length}. Open the Outreach tab`}");
  s = rep(s, 'Last run: {fmtTime(run?.lastGoodAt ?? null)}</div>', 'Last run: {fmtTime(run?.lastGoodAt ?? null)}<span> · updates automatically every 6 hours</span></div>');
  return s;
});

// ---- tests ----
edit("src/lib/scoring.test.ts", (s) => {
  s = rep(s, "qualifies, MIN_MAKER_COMMENTS, MIN_UPVOTES }", "qualifies, MIN_MAKER_COMMENTS, FRESH_HOURS }");
  const a = s.indexOf('test("qualification:');
  if (a < 0) throw new Error("qualification test not found");
  return s.slice(0, a) + `test("qualification: fresh launches are always ranked, older ones need their makers to have commented", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 36e5).toISOString();
  assert.equal(MIN_MAKER_COMMENTS, 1);
  assert.equal(FRESH_HOURS, 24);
  assert.equal(qualifies({ votes: 0, makerComments: 0, createdAt: hoursAgo(4) }, now), true); // launched 4 hours ago, no traction yet
  assert.equal(qualifies({ votes: 2, makerComments: 1, createdAt: hoursAgo(10) }, now), true); // intro comment only, still fresh
  assert.equal(qualifies({ votes: 83, makerComments: 1, createdAt: hoursAgo(40) }, now), true); // older, but the makers commented
  assert.equal(qualifies({ votes: 186, makerComments: 0, createdAt: hoursAgo(70) }, now), false); // older, makers never commented
  assert.equal(qualifies({ votes: 1, makerComments: 1, createdAt: hoursAgo(100) }, now), true); // no upvote floor
});
`;
});

// ---- README ----
edit("README.md", (s) => {
  const a = s.indexOf("**that qualifies**");
  const marker = "constants in `src/lib/scoring.ts`.";
  const b = s.indexOf(marker, a);
  if (a < 0 || b < 0) throw new Error("README qualification text not found");
  const text =
    "**that is ranked**. Every launch under 24 hours old is ranked, because it has had no time to build traction. An older launch is ranked once its makers have commented on their launch (the usual intro post counts). There is no minimum number of upvotes. This is an addition to the written rubric: in testing, 41 of 310 relevant launches had no maker comments at all (mostly large companies whose makers never reply to anyone). Those wait on the Watchlist and are re-checked on every run. The thresholds are constants in `src/lib/scoring.ts`.";
  return s.slice(0, a) + text + s.slice(b + marker.length);
});
