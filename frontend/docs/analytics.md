# ODY 분석 운영 가이드

## 수집 원칙

- 제품 행동 이벤트는 GA4와 PostHog에 같은 이름과 의미로 보낸다.
- PostHog만 자동 클릭 수집과 세션 리플레이를 추가한다. 직접 정의한 버튼 영역에는 `data-analytics-manual`을 붙여 자동 클릭과 중복되지 않게 한다.
- 프레임 렌더, 마우스 이동 좌표, 휠 한 틱, 재생 진행률 틱은 보내지 않는다. 휠·드래그는 한 동작이 끝났을 때 한 건으로 합친다.
- 청취 시간은 UI의 재생 요청이 아니라 YouTube 플레이어가 실제 `PLAYING`을 보고한 구간만 잰다. 20초가 되면 `play_qualified` 한 건을 보낸다.
- 체류 시간은 120초, 화면 전환, 탭 가림, 페이지 이탈 때 `engagement_recorded` 차분값으로 보낸다. 매초 이벤트를 보내지 않는다.
- 로그인 없이 `ody_anon_id`로 브라우저를 구분한다. 검색어, 이메일, 곡 제목은 보내지 않는다.

## 환경변수

서버 실행 환경에 아래 값을 넣는다. `NEXT_PUBLIC_` 값이 아니어서 재빌드 없이 서버 재시작만으로 수집 범위를 바꿀 수 있다.

```dotenv
ANALYTICS_MODE=live
GA_MEASUREMENT_ID=G-XXXXXXXXXX
POSTHOG_PROJECT_KEY=phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
POSTHOG_REGION=us
POSTHOG_MODE=all
POSTHOG_REPLAY=true
ANALYTICS_TEST_PHASE=before
ANALYTICS_RELEASE=2026-09-user-test
```

`ANALYTICS_MODE=debug`이면 외부로 보내지 않고 브라우저 콘솔과 `window.__odyAnalytics`에 최근 500건을 남긴다. localhost에서 `live`를 지정해도 자동으로 debug가 된다.

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
| 지도 | `map_ready`, `map_pan_completed`, `map_zoom_completed`, `map_layer_changed`, `music_hovered`, `music_clicked`, `music_detail_viewed` |
| 검색 | `search_opened`, `search_executed`, `search_results_viewed`, `search_result_selected`, `search_more_requested`, `search_closed` |
| 주변 탐색 | `nearby_opened`, `nearby_center_changed`, `nearby_results_viewed`, `nearby_closed` |
| 경로 탐색 | `journey_composer_opened`, `journey_endpoint_changed`, `journey_create_requested`, `journey_create_result`, `journey_results_viewed`, `journey_cleared` |
| 재생 | `play_requested`, `play_started`, `play_paused`, `play_resumed`, `play_seeked`, `play_qualified`, `play_ended`, `playback_issue` |
| 설문 | `survey_shown`, `survey_answer_selected`, `survey_submit_requested`, `survey_submit_result`, `survey_unanswered_requested` |
| 체류·UI | `engagement_recorded`, `panel_changed`, `view_mode_changed`, `help_opened`, `activity_switch_*`, `action_blocked`, `feature_request_failed` |

`engagement_recorded`에는 `foreground_ms`, `explore_ms`, `playback_ms`, `survey_ms`가 들어간다. 합계는 각 이벤트의 값을 더해서 계산한다. `view_mode=nearby|constellation|default`, `phase=guide|tutorial|free`, `playback_context=single|nearby|journey|playlist`로 구간을 나눈다.

## 대시보드 설정

GA4 맞춤 측정기준에는 값 종류가 제한적인 `phase`, `view_mode`, `playback_context`, `source`, `outcome`, `test_phase`, `release`만 등록한다. `anonymous_id`, `visit_id`, `event_id`, `music_id`, `journey_id`, `search_id`는 값이 너무 다양하므로 맞춤 측정기준으로 등록하지 않는다.

먼저 만들 보고서는 다음 네 개다.

1. `free_explore_started → nearby_opened → nearby_results_viewed → play_started → play_qualified`
2. `free_explore_started → journey_composer_opened → journey_create_requested → journey_create_result → journey_results_viewed → play_started`
3. `play_requested → play_started → play_qualified → play_ended`와 `playback_issue` 사유
4. `engagement_recorded`의 `explore_ms`를 `view_mode`별로 합산한 체류 시간

PostHog에서는 위 퍼널에 세션 리플레이를 연결한다. GA4에서는 같은 이벤트로 장기 추세를 유지한다.

## 계정에서 직접 해야 하는 일

1. GA4 웹 데이터 스트림을 만들고 측정 ID `G-…`를 복사한다.
2. PostHog 프로젝트를 만들고 Project API key `phc_…`와 리전(US/EU)을 확인한다.
3. 서버 환경변수를 설정하고 재시작한다. Personal API key나 계정 비밀번호는 필요 없다.
4. 브라우저 개발자 도구에서 `/bff/analytics-config` 응답을 확인하고, GA4 Realtime/DebugView와 PostHog Live Events에서 `page_view` 한 건을 확인한다.
5. PostHog Billing limits에서 Product Analytics와 Session Replay 한도 알림을 켠다.
