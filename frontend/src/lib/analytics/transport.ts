import type { PostHog } from "posthog-js";
import { ANALYTICS } from "@/constants/analytics";
import type { AnalyticsConfig, AnalyticsEvent } from "@/types/analytics";
import { connectAnalytics } from "./client";
import { allowsPostHog, sanitizeProperties } from "./policy";
import { getAnonymousId } from "@/lib/anonymous-id";
import { analyticsDebugEnabled, analyticsEnabled, analyticsEnvironment, analyticsRuntimePolicy } from "./mode";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __odyAnalytics?: AnalyticsEvent[];
  }
}
let config: AnalyticsConfig | undefined;
let posthog: PostHog | undefined;
let initialized = false;
let gaId = "";

function recordLocal(event: AnalyticsEvent, properties: AnalyticsEvent["properties"]): void {
  const entries = window.__odyAnalytics ??= [];
  entries.push({ ...event, properties });
  if (entries.length > 500) entries.shift();
  console.debug("[analytics]", event.name, properties);
}

function commonProperties(next: AnalyticsConfig): Record<string, string> {
  return {
    release: next.release,
    test_phase: next.testPhase,
    ph_policy: next.posthogMode,
    data_source: next.dataSource,
    environment: analyticsEnvironment(location.hostname),
  };
}

function deliver(event: AnalyticsEvent): void {
  if (!config) return;
  const runtime = analyticsRuntimePolicy(location.hostname, config.dataSource, analyticsEnabled());
  if (!runtime.logLocal && !runtime.sendExternal) return;
  const properties = sanitizeProperties({ ...event.properties, ...commonProperties(config) });
  if (runtime.logLocal) recordLocal(event, properties);
  if (!runtime.sendExternal) return;
  // 각각 독립적으로 전송한다. 한 SDK의 차단/오류가 다른 쪽 수집을 중단하지 않는다.
  try { if (gaId) window.gtag?.("event", event.name, { ...properties, send_to: gaId }); } catch { /* SDK 차단 */ }
  try {
    if (posthog && allowsPostHog(event.name, config.posthogMode)) {
      const name = event.name === "page_view" ? "$pageview" : event.name === "page_leave" ? "$pageleave" : event.name;
      posthog.capture(name, properties, { timestamp: new Date(event.timestamp) });
    }
  } catch { /* SDK 차단 */ }
}

async function applyConfig(next: AnalyticsConfig): Promise<void> {
  config = next;
  // 브라우저 OFF와 목데이터는 SDK 자체를 시작하지 않는다.
  if (!analyticsRuntimePolicy(location.hostname, next.dataSource, analyticsEnabled()).sendExternal) {
    gaId = "";
    posthog?.stopSessionRecording();
    posthog?.set_config({ autocapture: false });
    return;
  }
  if (next.gaId && gaId !== next.gaId) {
    gaId = next.gaId;
    window.dataLayer ??= [];
    window.gtag ??= (...args: unknown[]) => { window.dataLayer!.push(args); };
    window.gtag("js", new Date());
    window.gtag("set", commonProperties(next));
    window.gtag("config", gaId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: location.origin + location.pathname,
      page_referrer: document.referrer ? new URL(document.referrer).origin : "",
      ...(analyticsDebugEnabled() ? { debug_mode: true } : {}),
    });
    if (!document.getElementById("ody-ga4")) {
      const script = document.createElement("script");
      script.id = "ody-ga4";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
      document.head.appendChild(script);
    }
  } else if (!next.gaId) gaId = "";
  if (!posthog && next.posthogKey && next.posthogMode !== "off") {
    try {
      const { default: sdk } = await import("posthog-js");
      // 설정을 다시 읽는 중 정책이 바뀌었으면 옛 요청으로 켜지 않는다.
      if (config !== next) return;
      sdk.init(next.posthogKey, {
        api_host: next.posthogHost,
        defaults: "2026-01-30",
        bootstrap: { distinctID: getAnonymousId(), isIdentifiedID: false },
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: false,
        autocapture: { dom_event_allowlist: ["click", "submit"], css_selector_ignorelist: ["[data-analytics-manual]", "[data-analytics-manual] *", "canvas"] },
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_performance: false,
        capture_exceptions: false,
        rageclick: false,
        disable_surveys: true,
        enable_recording_console_log: false,
        disable_session_recording: !next.replay,
        session_recording: {
          maskAllInputs: true,
          captureCanvas: { canvasFps: 2, canvasQuality: "0.2" },
          recordHeaders: false,
          recordBody: false,
        },
        before_send: (event) => {
          if (!event || config?.dataSource !== "live" || config.posthogMode === "off" || !analyticsEnabled()) return null;
          if (event.event === "$snapshot") return config.replay ? event : null;
          const semantic = event.event === "$pageview" ? "page_view" : event.event === "$pageleave" ? "page_leave" : event.event;
          if (!allowsPostHog(semantic, config.posthogMode)) return null;
          // 자동 속성에 URL 쿼리/해시, 인증 콜백 코드가 섞이지 않게 한다.
          for (const key of ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer"]) {
            const value = event.properties[key];
            if (typeof value === "string") {
              try { const url = new URL(value); event.properties[key] = url.origin + url.pathname; } catch { delete event.properties[key]; }
            }
          }
          return event;
        },
      });
      posthog = sdk;
    } catch { /* 패키지 청크/수집 서버 장애 시 GA 수집은 유지한다. */ }
  }
  if (posthog) {
    posthog.register(commonProperties(next));
    posthog.set_config({ autocapture: next.posthogMode === "all" ? { dom_event_allowlist: ["click", "submit"], css_selector_ignorelist: ["[data-analytics-manual]", "[data-analytics-manual] *", "canvas"] } : false });
    if (next.replay && next.posthogMode !== "off") posthog.startSessionRecording();
    else posthog.stopSessionRecording();
  }
}

export async function startTransport(): Promise<void> {
  if (initialized) return;
  initialized = true;
  const refresh = async () => {
    try {
      const response = await fetch("/bff/analytics-config", { cache: "no-store", signal: AbortSignal.timeout(5000) });
      if (!response.ok) return;
      await applyConfig(await response.json() as AnalyticsConfig);
    } catch { /* 설정 요청 실패 시 마지막 정책 유지, 최초 실패 시 전송 안 함 */ }
  };
  await refresh();
  connectAnalytics(deliver);
  window.setInterval(() => { void refresh(); }, ANALYTICS.checkpointMs);
}
