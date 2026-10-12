import { getDashboard } from "../../../lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const full = new URL(req.url).searchParams.get("filtered") === "1";
  try {
    return Response.json(await getDashboard(full));
  } catch (e) {
    return Response.json({ error: "Could not read the database." }, { status: 500 });
  }
}
