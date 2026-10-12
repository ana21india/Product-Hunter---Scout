export const dynamic = "force-dynamic";

// Tells which commit the running site was built from, so a deployment can be confirmed without looking at the Vercel dashboard.
export async function GET() {
  return Response.json({
    commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
    message: (process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "").slice(0, 80),
  });
}
