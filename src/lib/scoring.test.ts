import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreLaunches, eligibleSet, tierForRank, qualifies, MIN_MAKER_COMMENTS, FRESH_HOURS } from "./scoring";

const NOW = new Date("2026-10-12T12:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * 864e5).toISOString();
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("hand-checked example matches the rubric", () => {
  // max upvotes = 200, max maker comments = 20
  const out = scoreLaunches(
    [
      { postId: "1", votes: 200, makerComments: 10, createdAt: ago(1) }, // U=100, M=50  -> 60 + 20 = 80
      { postId: "2", votes: 100, makerComments: 20, createdAt: ago(2) }, // U=50,  M=100 -> 30 + 40 = 70
      { postId: "3", votes: 50, makerComments: 0, createdAt: ago(3) }, //   U=25,  M=0   -> 15
      { postId: "4", votes: 0, makerComments: 0, createdAt: ago(0.5) }, //  U=0,   M=0   -> 0
    ],
    NOW,
  );
  assert.deepEqual(out.map((o) => o.postId), ["1", "2", "3", "4"]);
  close(out[0].upvoteScore, 100); close(out[0].makerScore, 50); close(out[0].finalScore, 80);
  close(out[1].upvoteScore, 50); close(out[1].makerScore, 100); close(out[1].finalScore, 70);
  close(out[2].finalScore, 15);
  close(out[3].finalScore, 0);
  close(out[0].upvotePoints, 60); close(out[0].makerPoints, 20);
  assert.deepEqual(out.map((o) => o.rank), [1, 2, 3, 4]);
});

test("zero maximum gives 0 for that metric, with no division by zero", () => {
  const out = scoreLaunches(
    [
      { postId: "1", votes: 100, makerComments: 0, createdAt: ago(1) },
      { postId: "2", votes: 50, makerComments: 0, createdAt: ago(1) },
    ],
    NOW,
  );
  assert.equal(out[0].makerScore, 0);
  assert.equal(out[1].makerScore, 0);
  close(out[0].finalScore, 60);
  close(out[1].finalScore, 30);
  const allZero = scoreLaunches([{ postId: "9", votes: 0, makerComments: 0, createdAt: ago(1) }], NOW);
  assert.equal(allZero[0].finalScore, 0);
  assert.ok(Number.isFinite(allZero[0].finalScore));
});

test("final score always stays between 0 and 100", () => {
  const out = scoreLaunches(
    Array.from({ length: 30 }, (_, i) => ({ postId: String(i + 1), votes: (i * 37) % 500, makerComments: (i * 13) % 40, createdAt: ago((i % 7) + 0.1) })),
    NOW,
  );
  for (const o of out) assert.ok(o.finalScore >= 0 && o.finalScore <= 100 + 1e-9);
});

test("tie on final score: more maker comments first, then more upvotes", () => {
  // X: U=100, M=0 -> 60.  Y: U=50, M=75 -> 60.  Z sets max maker comments to 100.
  const out = scoreLaunches(
    [
      { postId: "10", votes: 100, makerComments: 0, createdAt: ago(1) },
      { postId: "11", votes: 50, makerComments: 75, createdAt: ago(1) },
      { postId: "12", votes: 0, makerComments: 100, createdAt: ago(1) },
    ],
    NOW,
  );
  close(out[0].finalScore, out[1].finalScore);
  assert.equal(out[0].postId, "11"); // 75 maker comments beats 0
  assert.equal(out[1].postId, "10");
  // identical scores and maker comments: more upvotes first
  const t2 = scoreLaunches(
    [
      { postId: "21", votes: 10, makerComments: 5, createdAt: ago(1) },
      { postId: "22", votes: 10, makerComments: 5, createdAt: ago(1) },
    ],
    NOW,
  );
  assert.equal(t2[0].postId, "21"); // final tie-break: older post id
});

test("eligible set: only the last 7 days, duplicates removed by post id", () => {
  const rows = [
    { postId: "1", votes: 5, makerComments: 1, createdAt: ago(6.9) },
    { postId: "1", votes: 5, makerComments: 1, createdAt: ago(6.9) },
    { postId: "2", votes: 99, makerComments: 9, createdAt: ago(7.1) },
    { postId: "3", votes: 5, makerComments: 1, createdAt: ago(0) },
  ];
  assert.deepEqual(eligibleSet(rows, NOW).map((r) => r.postId), ["1", "3"]);
  // an expired launch must not set the "highest" values
  const out = scoreLaunches(rows, NOW);
  close(out[0].upvoteScore, 100);
});

test("tiers follow rank bands 1-4 / 5-8 / 9-12 / 13+", () => {
  assert.equal(tierForRank(1), "Priority");
  assert.equal(tierForRank(4), "Priority");
  assert.equal(tierForRank(5), "Strong fit");
  assert.equal(tierForRank(8), "Strong fit");
  assert.equal(tierForRank(9), "Consider");
  assert.equal(tierForRank(12), "Consider");
  assert.equal(tierForRank(13), "Lower priority");
});

test("days since launch, days left, and the Closing flag (day 6 to 7)", () => {
  const out = scoreLaunches(
    [
      { postId: "1", votes: 1, makerComments: 0, createdAt: ago(0.2) },
      { postId: "2", votes: 1, makerComments: 0, createdAt: ago(5.9) },
      { postId: "3", votes: 1, makerComments: 0, createdAt: ago(6.5) },
    ],
    NOW,
  );
  const by = Object.fromEntries(out.map((o) => [o.postId, o]));
  assert.equal(by["1"].daysSince, 0); assert.equal(by["1"].daysLeft, 7); assert.equal(by["1"].closing, false);
  assert.equal(by["2"].daysSince, 5); assert.equal(by["2"].closing, false);
  assert.equal(by["3"].daysSince, 6); assert.equal(by["3"].daysLeft, 1); assert.equal(by["3"].closing, true);
});

test("empty set returns an empty list", () => {
  assert.deepEqual(scoreLaunches([], NOW), []);
});

test("qualification: fresh launches are always ranked, older ones need their makers to have commented", () => {
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
