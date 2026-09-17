"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";
import AnalyticsProvider from "./analytics-provider";
import { track } from "@/lib/analytics/client";

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (_error, query) => {
        // 최종 실패만 기록한다. 검색어·인증 정보가 섞인 queryKey 전체는 보내지 않는다.
        track("feature_request_failed", { feature: String(query.queryKey[0]), operation: String(query.queryKey[1] ?? "query") });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export default function QueryProvider({ children }: { children: ReactNode }) {
  // useState로 클라이언트 인스턴스를 고정해 리렌더 시 재생성되지 않도록 함
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AnalyticsProvider />
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
