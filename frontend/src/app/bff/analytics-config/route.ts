import { publicAnalyticsConfig } from "@/lib/analytics/policy";

/** 공개 수집 키만 반환. 런타임 설정이므로 수집 범위 변경에 FE 재빌드가 필요 없다. */
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(publicAnalyticsConfig(process.env), { headers: { "Cache-Control": "no-store" } });
}
