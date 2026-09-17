import { POSTHOG_CORE_EVENTS } from "../../constants/analytics";
import type { AnalyticsConfig, AnalyticsProps, PostHogMode } from "../../types/analytics";

export function allowsPostHog(name: string, mode: PostHogMode): boolean {
  return mode === "all" || (mode === "core" && POSTHOG_CORE_EVENTS.has(name));
}

/** GA에도 같은 스칼라 속성을 전송한다. 고유 ID는 수집하되 맞춤 측정기준으로 등록하지 않는다. */
export function sanitizeProperties(properties: AnalyticsProps): AnalyticsProps {
  const result: AnalyticsProps = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key) || value == null) continue;
    if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
    else if (typeof value === "boolean") result[key] = value;
    else if (typeof value === "string") result[key] = value.slice(0, 100);
    if (Object.keys(result).length === 25) break;
  }
  return result;
}

export function publicAnalyticsConfig(env: Record<string, string | undefined>): AnalyticsConfig {
  return {
    mode: env.ANALYTICS_MODE === "live" ? "live" : env.ANALYTICS_MODE === "debug" ? "debug" : "off",
    gaId: /^G-[A-Z0-9]+$/.test(env.GA_MEASUREMENT_ID ?? "") ? env.GA_MEASUREMENT_ID! : "",
    posthogKey: /^phc_[a-zA-Z0-9]+$/.test(env.POSTHOG_PROJECT_KEY ?? "") ? env.POSTHOG_PROJECT_KEY! : "",
    posthogHost: env.POSTHOG_REGION === "eu" ? "https://eu.i.posthog.com" : "https://us.i.posthog.com",
    posthogMode: env.POSTHOG_MODE === "off" ? "off" : env.POSTHOG_MODE === "core" ? "core" : "all",
    replay: env.POSTHOG_REPLAY !== "false",
    release: (env.ANALYTICS_RELEASE ?? "unversioned").slice(0, 100),
    testPhase: (env.ANALYTICS_TEST_PHASE ?? "test").slice(0, 100),
  };
}
