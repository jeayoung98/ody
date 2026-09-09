import { ok } from "@/lib/api-response";
import { mockProfile } from "@/mocks/user";

export async function GET(_req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  return ok(mockProfile(decodeURIComponent(email)));
}
