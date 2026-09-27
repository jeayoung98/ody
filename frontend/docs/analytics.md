# ODY 분석 운영 가이드

## 수집 원칙

- 제품 행동 이벤트는 GA4와 PostHog에 같은 이름과 의미로 보낸다.
- PostHog만 자동 클릭 수집과 세션 리플레이를 추가한다. 직접 정의한 버튼 영역에는 `data-analytics-manual`을 붙여 자동 클릭과 중복되지 않게 한다.
- 프레임 렌더, 마우스 이동 좌표, 휠 한 틱, 재생 진행률 틱은 보내지 않는다. 휠·드래그는 한 동작이 끝났을 때 한 건으로 합친다.
- 청취 시간은 UI의 재생 요청이 아니라 YouTube 플레이어가 실제 `PLAYING`을 보고한 구간만 잰다. 20초가 되면 `play_qualified` 한 건을 보낸다.
- 체류 시간은 120초, 화면 전환, 탭 가림, 페이지 이탈 때 `engagement_recorded` 차분값으로 보낸다. 매초 이벤트를 보내지 않는다.
- 로그인 없이 `ody_anon_id`로 브라우저를 구분한다. 검색어, 이메일, 곡 제목은 보내지 않는다.
- 실데이터 localhost에는 `environment=development`, 배포 호스트에는 `environment=production`을 붙여 GA4와 PostHog에 같은 방식으로 보낸다.
- 목데이터(`USE_MOCK_API=1`)는 외부로 보내지 않고 localhost 콘솔에만 기록한다.
- 팀원이 분석을 남기지 않고 확인할 때는 브라우저의 `ody:analytics-mode`를 `false`로 설정한다.

## 실행 정책

| 환경 | 외부 분석 | 개발 로그 |
| --- | --- | --- |
| localhost + 실데이터 | GA4·PostHog 전송, `environment=development` | 콘솔과 `window.__odyAnalytics` |
| localhost + 목데이터 | 미전송 | 콘솔과 `window.__odyAnalytics` |
| 배포 호스트 + 실데이터 | GA4·PostHog 전송, `environment=production` | 남기지 않음 |
| `ody:analytics-mode=false` | 환경과 관계없이 미전송 | 남기지 않음 |

development/production은 호스트로 자동 판별한다. 서버 모드 값을 수동으로 바꾸지 않는다.

## 환경변수

서버 실행 환경에 아래 값을 넣는다. `NEXT_PUBLIC_` 값이 아니어서 재빌드 없이 서버 재시작만으로 수집 범위를 바꿀 수 있다.

```dotenv
GA_MEASUREMENT_ID=G-XXXXXXXXXX
POSTHOG_PROJECT_KEY=phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
POSTHOG_REGION=us
POSTHOG_MODE=all
POSTHOG_REPLAY=true
ANALYTICS_TEST_PHASE=before
ANALYTICS_RELEASE=2026-09-user-test
```

분석 키가 있고 실데이터를 사용하면 외부로 전송한다. localhost에서는 같은 이벤트를 콘솔과 `window.__odyAnalytics`에도 최대 500건 남긴다. 목데이터는 키가 있어도 외부로 보내지 않는다.

브라우저별 분석 스위치는 설문 모드와 같은 `true`/`false` 규칙을 쓴다. 값이 없거나 `true`면 기본 동작이고, `false`면 GA4·PostHog 수동 이벤트, autocapture, 세션 리플레이와 SDK 초기화를 모두 끈다.

```js
localStorage.setItem("ody:analytics-mode", "false"); location.reload(); // 분석 끄기
localStorage.setItem("ody:analytics-mode", "true");  location.reload(); // 분석 켜기
localStorage.removeItem("ody:analytics-mode");        location.reload(); // 기본값으로 복구
```

이 스위치는 localhost와 배포 호스트에서 똑같이 동작한다. 로컬에서 UI만 확인할 때 외부 DEV 데이터를 남기지 않는 용도로도 쓸 수 있으므로 별도 예외를 두지 않는다.

GA4 DebugView는 해당 브라우저만 다음처럼 켠다. `false`를 저장하는 대신 키를 제거해야 디버그 파라미터가 빠진다.

```js
localStorage.setItem("ody:analytics-debug", "true"); location.reload(); // GA4 DebugView 켜기
localStorage.removeItem("ody:analytics-debug");       location.reload(); // GA4 DebugView 끄기
```

이 값은 GA4의 `debug_mode`에만 영향을 주며 PostHog, 환경 구분, 콘솔 로그에는 영향을 주지 않는다.

설문과 분석을 한 번에 끄거나 기본값으로 복구하려면 다음처럼 두 키를 함께 조정한다.

```js
localStorage.setItem("ody:analytics-mode", "false"); localStorage.setItem("ody:survey-mode", "false"); location.reload();
localStorage.removeItem("ody:analytics-mode"); localStorage.removeItem("ody:survey-mode"); location.reload();
```

설문 응답은 배포 호스트에서 운영 DB에 저장한다. localhost에서는 로컬 Spring 백엔드를 실행하고 `BACKEND_ORIGIN=http://localhost:8080`, `SURVEY_TEST_DATABASE=local`, `USE_MOCK_API=0`을 함께 설정한 경우에만 로컬 DB에 저장한다. `USE_MOCK_API=1`이면 어떤 환경에서도 저장하지 않는다. `ody:analytics-mode`는 설문 저장 여부에 영향을 주지 않는다.

`ody:survey-mode=false`이면 `SurveyGate`가 설문 실행 컴포넌트를 렌더링하지 않으므로 설문 표시와 제출이 함께 꺼진다. localhost와 배포 호스트에서 동일하게 동작한다. 단, 빌드 설정 `NEXT_PUBLIC_TEST_TOOLS=0`인 최종 빌드에서는 설문을 브라우저 값으로 다시 켤 수 없다.

PostHog 사용량을 줄일 때는 다음 순서로 바꾼다.

1. `POSTHOG_MODE=all`: 직접 정의한 이벤트, 자동 클릭, 리플레이를 수집한다.
2. `POSTHOG_MODE=core`: 퍼널·탐색·청취·체류 핵심 이벤트와 리플레이만 수집한다. 자동 클릭과 세부 조작 이벤트는 버린다.
3. `POSTHOG_REPLAY=false`: 리플레이 한도가 부족하면 이벤트 수집은 유지하고 녹화만 멈춘다.
4. `POSTHOG_MODE=off`: PostHog 전송을 멈춘다. GA4는 계속 수집한다.

클라이언트는 120초마다 공개 설정을 다시 읽으므로 이미 열린 탭에도 변경 사항이 반영된다.

## 핵심 이벤트

| 목적 | 이벤트 |
| --- | --- |
| 방문·단계 | `page_view`, `page_leave`, `test_guide_*`, `tutorial_*`, `free_explore_started` |
| 지도 | `map_ready`, `map_pan_completed`, `map_zoom_completed`, `map_layer_changed`, `music_clicked`, `music_detail_viewed` |
| 검색 | `search_opened`, `search_executed`, `search_results_viewed`, `search_result_selected`, `search_more_requested`, `search_closed` |
| 주변 탐색 | `nearby_opened`, `nearby_center_changed`, `nearby_results_viewed`, `nearby_closed` |
| 경로 탐색 | `journey_composer_opened`, `journey_endpoint_changed`, `journey_create_requested`, `journey_create_result`, `journey_results_viewed`, `journey_cleared` |
| 재생 | `play_requested`, `play_started`, `play_paused`, `play_resumed`, `play_seeked`, `play_qualified`, `play_ended`, `playback_issue` |
| 체류·UI | `engagement_recorded`, `panel_changed`, `view_mode_changed`, `help_opened`, `activity_switch_*`, `action_blocked`, `feature_request_failed` |

`engagement_recorded`에는 `foreground_ms`, `explore_ms`, `playback_ms`가 들어간다. 합계는 각 이벤트의 값을 더해서 계산한다. `view_mode=nearby|constellation|default`, `phase=guide|tutorial|free`, `playback_context=single|nearby|journey|playlist`로 구간을 나눈다. 설문 동작과 호버는 분석 이벤트로 수집하지 않는다.

`playback_ms`는 YouTube 플레이어가 실제 `PLAYING` 상태였던 구간의 시간이다. 매초 보내지 않고 재생 상태·분석 문맥이 바뀔 때와 120초 체크포인트에 직전 구간의 차분값을 보낸다.

지도 별의 첫 클릭은 `music_clicked(action=inspect)`, 같은 별을 다시 눌러 재생하는 클릭은 `music_clicked(action=play)`로 구분한다. 재생 클릭 뒤에는 요청 시 `play_requested`, 실제 YouTube 재생이 시작되면 `play_started`가 별도로 이어진다. 여정 출발·도착 지정은 `action=set_start|set_end`로 구분한다.

## 대시보드 설정

GA4 맞춤 측정기준에는 값 종류가 제한적인 `environment`, `phase`, `view_mode`, `playback_context`, `source`, `outcome`, `test_phase`, `data_source`, `release`만 등록한다. 기본 보고서는 `environment=production`으로 필터링한다. `anonymous_id`, `visit_id`, `event_id`, `music_id`, `journey_id`, `search_id`는 값이 너무 다양하므로 맞춤 측정기준으로 등록하지 않는다.

먼저 만들 보고서는 다음 네 개다.

1. `free_explore_started → nearby_opened → nearby_results_viewed → play_started → play_qualified`
2. `free_explore_started → journey_composer_opened → journey_create_requested → journey_create_result → journey_results_viewed → play_started`
3. `play_requested → play_started → play_qualified → play_ended`와 `playback_issue` 사유
4. `engagement_recorded`의 `explore_ms`를 `view_mode`별로 합산한 체류 시간

PostHog에서는 위 퍼널에 세션 리플레이를 연결한다. GA4에서는 같은 이벤트로 장기 추세를 유지한다.

## 계정에서 직접 해야 하는 일

1. GA4 웹 데이터 스트림을 만들고 측정 ID `G-…`를 복사한다.
2. PostHog 프로젝트를 만들고 Project API key `phc_…`와 리전(US/EU)을 확인한다.
3. 서버 환경변수에 GA4·PostHog 키를 설정하고 재시작한다. Personal API key나 계정 비밀번호는 필요 없다.
4. 브라우저 개발자 도구에서 `/bff/analytics-config` 응답을 확인하고, GA4 실시간 개요와 PostHog Live Events에서 `page_view` 한 건을 확인한다. GA4 DebugView를 사용할 때는 먼저 Google Tag Assistant로 해당 브라우저를 연결한다.
5. PostHog Billing limits에서 Product Analytics와 Session Replay 한도 알림을 켠다.
