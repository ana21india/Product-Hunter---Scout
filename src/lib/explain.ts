// Plain-language explanations built only from the real numbers, so they are always true to the score.
import type { Scored, RawLaunch } from "./scoring";

type Item = Scored<RawLaunch & { name: string }>;

const pts = (n: number) => n.toFixed(1);

// Why `hi` (better rank) was prioritised over `lo`.
export function explainCompare(hi: Item, lo: Item): string {
  const upDiff = hi.upvotePoints - lo.upvotePoints;
  const mkDiff = hi.makerPoints - lo.makerPoints;
  const parts: string[] = [];
  parts.push(`${hi.name} (rank ${hi.rank}, score ${pts(hi.finalScore)}) is prioritised over ${lo.name} (rank ${lo.rank}, score ${pts(lo.finalScore)}).`);
  const clause = (label: string, a: number, b: number, diff: number) =>
    diff > 0.05 ? `${label}: ${a} vs ${b} adds ${pts(diff)} points in its favour`
    : diff < -0.05 ? `${label}: ${a} vs ${b} costs ${pts(-diff)} points, but this is outweighed`
    : `${label}: ${a} vs ${b} is about even`;
  parts.push(`${clause("Upvotes", hi.votes, lo.votes, upDiff)}; ${clause("maker comments", hi.makerComments, lo.makerComments, mkDiff)}.`);
  if (lo.closing && !hi.closing) parts.push(`${lo.name} is also nearly out of the 7-day window (${lo.daysLeft} day left).`);
  return parts.join(" ");
}

// Why `item` (just below the shortlist) ranks lower than the last shortlisted product.
export function explainBelow(item: Item, cutoff: Item): string {
  // Plain wording without score numbers: what the launch has less of than the last one on the shortlist.
  const bits: string[] = [];
  if (item.votes < cutoff.votes) bits.push(`fewer upvotes (${item.votes} vs ${cutoff.votes})`);
  if (item.makerComments < cutoff.makerComments) bits.push(`fewer maker comments (${item.makerComments} vs ${cutoff.makerComments})`);
  if (!bits.length) bits.push("a slightly lower combined result");
  return `Ranked just below #${cutoff.rank}: ${bits.join(" and ")}`;
}
