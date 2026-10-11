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
  const upDiff = cutoff.upvotePoints - item.upvotePoints;
  const mkDiff = cutoff.makerPoints - item.makerPoints;
  const bits: string[] = [];
  if (cutoff.finalScore - item.finalScore < 0.05) {
    const why = item.makerComments < cutoff.makerComments ? "fewer maker comments"
      : item.votes < cutoff.votes ? "fewer upvotes" : "a later position on the tie-break (older post first)";
    return `Same score as rank ${cutoff.rank} (${pts(cutoff.finalScore)}), placed lower because of ${why}`;
  }
  if (upDiff > 0.05) bits.push(`fewer upvotes (${item.votes} vs ${cutoff.votes})`);
  if (mkDiff > 0.05) bits.push(`fewer maker comments (${item.makerComments} vs ${cutoff.makerComments})`);
  if (!bits.length) bits.push("a slightly lower combined score");
  return `${pts(cutoff.finalScore - item.finalScore)} points behind rank ${cutoff.rank}: ${bits.join(" and ")}`;
}
