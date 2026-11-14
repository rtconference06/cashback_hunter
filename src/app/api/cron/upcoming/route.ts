import { runUpcomingDigests } from "@/lib/digest-service";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return Response.json({ error: "Set CRON_SECRET before calling this endpoint." }, { status: 401 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const outcomes = await runUpcomingDigests();
  return Response.json({ ok: true, outcomes });
}
