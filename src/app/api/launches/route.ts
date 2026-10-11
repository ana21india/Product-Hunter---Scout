import { getDashboard } from "../../../lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getDashboard());
  } catch (e) {
    return Response.json({ error: "Could not read the database." }, { status: 500 });
  }
}
