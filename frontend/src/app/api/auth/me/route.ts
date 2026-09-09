import { ok } from "@/lib/api-response";
import { mockMe } from "@/mocks/user";

export function GET() {
  return ok(mockMe());
}
