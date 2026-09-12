import { sendDueReminders } from "@/server/services/reminders";

/**
 * Vercel Cron trigger (docs/architecture.md §1). This is not a domain
 * REST API — tRPC remains the only application surface
 * (docs/decisions.md #7). Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDueReminders();
  return Response.json(result);
}
