# 013. HTTP 테스트 주소에서 분석 이벤트가 전부 멈춤

- 이슈: S15P21A405-295
- 커밋 / MR: 작업 중
- 날짜: 2026-09-16

## 증상

1. 분석 설정을 `live`로 켜고 PC의 네트워크 주소로 프로덕션 빌드를 열었다.
2. GA4 태그 스크립트는 문서에 추가됐지만 GA4와 PostHog에 프론트 이벤트가 보이지 않았다.
3. 같은 PostHog 키로 직접 보낸 합성 이벤트는 정상 수신됐다.

## 처음 의심한 것

인앱 브라우저의 추적 차단을 먼저 의심했다. 실제로 GA4 브라우저 요청은 이 환경에서 확인되지 않았지만, PostHog까지 멈춘 직접 원인은 별도였다.

## 증거

HTTP 네트워크 주소로 연 페이지의 콘솔에서 첫 분석 이벤트 생성 시 다음 오류가 발생했다.

```text
TypeError: crypto.randomUUID is not a function
```

## 원인

`src/lib/analytics/client.ts`와 익명 ID·설문 세션 생성 코드가 `crypto.randomUUID()`를 직접 호출했다. 이 API는 보안 컨텍스트에서 제공되므로 HTTPS나 localhost가 아닌 HTTP 네트워크 주소에서는 없을 수 있다. 첫 `page_view`를 만드는 도중 예외가 발생해 이후 분석 흐름도 시작되지 않았다.

## 조치

`src/lib/uuid.ts`에 공통 UUID v4 생성기를 추가했다. `crypto.randomUUID()`가 있으면 그대로 사용하고, 없으면 `crypto.getRandomValues()`로 RFC 4122 버전·variant 비트를 설정해 생성한다. 분석 ID, 익명 ID, 설문 세션 ID가 이 함수를 공유하도록 바꿨다.

## 확인

| 시나리오 | 결과 |
| --- | --- |
| HTTP 네트워크 주소에서 프로덕션 빌드 열기 | `randomUUID` 오류 재발 없음 |
| PostHog Activity | `$pageview`, `$pageleave`, `test_guide_viewed`, `engagement_recorded`, `feature_request_failed` 수신 |
| GA4 수집 엔드포인트 합성 이벤트 | HTTP 204, 실시간 보고서에서 `integration_smoke_test` 1건 확인 |
| 회귀 검사 | 테스트 61개 및 프로덕션 빌드 통과 |

## 배운 것

브라우저 SDK가 로드됐는지만 보지 말고 첫 사용자 이벤트를 만드는 코드의 콘솔 오류부터 확인한다. 로컬 외 HTTP 주소로 테스트할 때는 보안 컨텍스트 전용 Web API 사용 여부도 함께 본다.
