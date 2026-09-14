import { ok } from "@/lib/api-response";

/** 따라가기 시작 */
export async function POST(_req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  return ok({ ok: true, leaderEmail: decodeURIComponent(email) });
}

/** 따라가기 해제(하차) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  return ok({ ok: true, leaderEmail: decodeURIComponent(email) });
}
