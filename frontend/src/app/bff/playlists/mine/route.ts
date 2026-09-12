import { ok } from "@/lib/api-response";
import { mockPlaylists } from "@/mocks/playlist";

export function GET() {
  return ok(mockPlaylists.mine());
}
