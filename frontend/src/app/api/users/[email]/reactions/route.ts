import { ok } from "@/lib/api-response";

/** 반응 전송. body: { reactionKey } */
export async function POST(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  const body = (await req.json().catch(() => ({}))) as { reactionKey?: string };
  return ok({ ok: true, toEmail: decodeURIComponent(email), reactionKey: body.reactionKey ?? null });
}
