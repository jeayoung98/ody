import { ok } from "@/lib/api-response";
import { mockSearch } from "@/mocks/music";

export function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return ok(mockSearch(q));
}
