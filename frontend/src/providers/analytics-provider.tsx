"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { observeAnalytics } from "@/lib/analytics/observe";
import { startTransport } from "@/lib/analytics/transport";
import { startEngagement, flushEngagement } from "@/lib/analytics/engagement";
import { analyticsContext, setAnalyticsContext, track } from "@/lib/analytics/client";

let path: string | undefined;
let listening = false;
export default function AnalyticsProvider() {
  const pathname = usePathname();
  useEffect(() => {
    void startTransport();
    observeAnalytics();
    startEngagement();
    if (pathname !== path) {
      if (path) { flushEngagement("navigation"); track("page_leave", { page_path: path, reason: "navigation" }); }
      const first = path === undefined;
      path = pathname;
      if (!first || !analyticsContext().phase) setAnalyticsContext({ phase: pathname.includes("tutorial") ? "tutorial" : pathname === "/" ? "loading" : "other" });
      track("page_view", { page_path: pathname, page_location: location.origin + pathname });
    }
    if (!listening) {
      listening = true;
      window.addEventListener("pagehide", () => track("page_leave", { page_path: path, reason: "pagehide" }));
    }
  }, [pathname]);
  return null;
}
