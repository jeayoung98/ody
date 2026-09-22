# Implementation Plan: 별자리 작품 AI 평가와 회차 리더보드

**Branch**: `backend/feat/S15P21A405-548-constellation-ai-leaderboard` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-constellation-artwork-ai/spec.md`

## Summary

제출하면 **그 순간의 별자리(곡·순서·좌표)를 통째로 복사해** 작품 행으로 남기고, 스케줄러가 그 좌표로 PNG 를 그려 GMS(`gpt5.4 mini`)에 "회차 주제를 얼마나 닮았나"를 묻는다. 점수가 붙은 작품만 회차 리더보드에 점수 순으로 선다. 좋아요는 `playlist_like` 구조를 그대로 베낀다.

새로 만드는 것은 도메인 하나(`artwork`)와 외부 어댑터 하나(GMS)다. 나머지는 이미 있는 것을 쓴다.

| 필요한 것 | 새로 만드나 | 무엇을 쓰나 |
| --- | --- | --- |
| 2D 좌표 계산 | 아니오 | `ConstellationService.layout(musicIds)` 를 그대로 호출 |
| 좋아요 | 아니오(구조 복제) | `playlist_like` 의 복합 PK + 비정규화 `like_cnt` 패턴 |
| 외부 HTTP | 아니오 | `RestClient` + `SimpleClientHttpRequestFactory` (`VideoIdApiClient` 와 같은 모양) |
| 비동기 실행 | 아니오 | `@EnableScheduling`·`@EnableAsync` 가 `RealtimeTaskConfig` 에 이미 켜져 있다 |
| 이미지 렌더 | 예 | **JDK 표준** `java.awt.image.BufferedImage` + `javax.imageio.ImageIO`. 의존성 추가 없음 |
| 곡 정보 일괄 조회 | 아니오 | 플레이리스트 상세가 쓰는 배치 조회 경로 |

## Technical Context

**Language/Version**: Java 17 (`sourceCompatibility = '17'`)

**Primary Dependencies**: Spring Boot 4.1.1, `RestClient`, MyBatis 4.1.0. **추가 의존성 없음** — 이미지 인코딩은 JDK `ImageIO`(PNG 는 JDK 기본 제공 writer)

**Storage**: PostgreSQL. 신규 테이블 4개 + 시퀀스 3개. DDL 은 `backend/src/main/resources/db/artwork_001_tables.sql` 에 두고 **사람이 DBeaver 로 실행**(기존 관례)

**Testing**: JUnit 5 + Mockito + AssertJ. GMS 어댑터는 `MockRestServiceServer`. 렌더러는 픽셀이 아니라 **출력 바이트가 PNG 이고 좌표가 같으면 바이트가 같다**는 결정성으로 검증

**Target Platform**: Linux 서버(Docker) 위 Spring Boot 단일 백엔드. `java.awt` 사용에 **`-Djava.awt.headless=true` 필요**(Spring Boot 기본값이 true 지만 명시)

**Project Type**: 웹 서비스 (`backend/` + `frontend/`)

**Performance Goals**: 제출 API 는 LLM 을 기다리지 않는다(SC-001). 평가 지연 목표는 **정하지 않는다** — GMS 실측 전에 숫자를 인수 기준으로 삼지 않는다(헌법 IX)

**Constraints**: GMS 호출은 연결 3초·읽기 30초에서 끊는다(vision 응답은 검색 API 보다 느리다 — 실측 후 조정). 한 번에 평가하는 작품 수는 배치 상한으로 묶는다

**Scale/Scope**: 신규 패키지 `com.ssafy.backend.artwork`. 신규 파일 약 30개, 기존 파일 수정 0~1개(에러 코드 enum 은 신규 파일)

### GMS 호출 계약

저장소에 GMS 사용처가 없다(`grep -ri gms` 무결과). 아래는 **설정으로 빼는 값**이다.

| 설정 키 | 값 | 상태 |
| --- | --- | --- |
| `ody.artwork.gms.base-url` | `https://gms.ssafy.io/gmsapi/api.openai.com` | **확인 완료** (2026-09-22 실호출) |
| `ody.artwork.gms.model` | `gpt-4o-mini` | **확인 완료**. 실제 응답 `model` 은 `gpt-4o-mini-2024-07-18` |
| `ody.artwork.gms.api-key` | 인증 키. `Authorization: Bearer <key>`. env 로만 주입, 저장소·로그 금지 (FR-016) | **확인 완료**. 값은 배포 호스트 `/etc/ody/backend.env` 에 있다 |
| `ody.artwork.gms.timeout-read-ms` | 읽기 타임아웃 10000 | 실측 0.85s 기준. 이미지가 커지면 재측정 |

#### 실호출 확인 (2026-09-22, 배포 호스트)

1×1 PNG 를 `image_url` data URI 로 실어 보낸 결과:

```text
HTTP 200  0.848465s
model: "gpt-4o-mini-2024-07-18"
usage.prompt_tokens: 8521   ← 1×1 이미지 한 장에
```

- **프록시가 `image_url` content 파트를 그대로 통과시킨다.** 설계의 "서버가 렌더한 PNG 를 보낸다"가 성립한다.
- 인증은 `Authorization: Bearer` 로 맞다.
- **이미지 토큰이 비싸다**: 1×1 짜리에 8,521 prompt token 이 붙었다. `gpt-4o-mini` 는 이미지 토큰에 큰 배수를 적용한다. GMS 가 Credit 을 **호출당 정액(2)** 으로 매기면 무시해도 되고, 토큰 비례면 이 값이 그대로 비용이다. **T000c 로 확인한다.**
- 대응 수단: 요청에 `"detail": "low"` 를 붙이면 이미지 토큰이 줄어든다. 별자리는 흑백 점·선이라 해상도를 낮춰도 형태 판단에 손해가 적다. 설정값(`ody.artwork.gms.image-detail`)으로 빼 두고 실측으로 정한다. **→ 아래 진단에서 `detail=low` 로 512×512 가 3,175 토큰 고정임을 확인.**

#### 변별력 진단 v1 (2026-09-22, `gpt-4o-mini`, `detail=low`, `temperature=0`)

손으로 만든 고양이 5종 + 대조군(직선·난수) + 재현성용 중복 1장을 서버에서 채점했다. 프롬프트는 말로 된 6구간 루브릭(spec Clarifications 의 앵커 방식).

| 그림 | 점수 | 기대 | 판정 |
| --- | --- | --- | --- |
| `cat_best` (23점 앉은 옆모습) | 80 | 90~100 | 낮지만 정직 — "비율이 어색" |
| `cat_best_again` | **80** | `cat_best` 와 같음 | ✅ **재현성 OK** — `temperature 0` 먹는다 |
| `cat_full` (18점 스케치) | 50 | 70~89 | 순서는 맞음 |
| `cat_awkward` | 30 | 50~79 | ✗ |
| `cat_no_tail` | 30 | 50~69 | ✗ |
| `cat_scrambled` | 30 | <50 | 값은 맞으나 이유 없음 |
| `cat_head_only` | 30 | 10~29 | ✗ |
| `line` | 0 | 0~9 | ✅ |
| `scatter` (난수 12점) | **30** | 0~9 | ✗ **꼬리 없는 고양이와 동점** |

**결론: 재현성은 확보, 변별력은 실패.** 그림 5종이 전부 30 이고 코멘트도 글자 하나 안 다르다("동물 같지만 고양이로 보기 어려움"). 점수가 80/50/30/0 으로 **구간 대표값에만 붙는다** — 6구간 말 루브릭이 0~100 채점기가 아니라 6지선다 분류기로 동작한다. 이대로면 리더보드 중하위가 전부 동점이 되어 순위가 좋아요 수로 결정된다.

원인은 앵커 개수다. 산출 공간이 6개면 결과도 6개다. **v2**: 항목 5개(전체 인상 0~40 + 귀·머리·몸통·꼬리 각 0~15)를 따로 매겨 합산시켜 산출 공간을 넓힌다. "전체 인상 10 아래면 합계 40 이하" 게이트로 부위만 세는 문제는 막는다. 프롬프트(`theme_prompt`)만 바뀌고 코드 변경은 없다.

#### 변별력 진단 v2 (같은 날, `gpt-4o-mini`, 항목 합산 프롬프트) — **더 나빠졌다**

| 그림 | v1 | v2 |
| --- | --- | --- |
| `cat_best` | 80 | 60 |
| `cat_best_again` | 80 | **35** |
| `cat_full` | 50 | 30 |
| `cat_awkward` | 30 | 25 |
| `cat_no_tail` | 30 | 30 |
| `cat_scrambled` | 30 | 25 |
| `cat_head_only` | 30 | 25 |
| `line` | 0 | 0 |
| `scatter` | 30 | 25 |

- **재현성이 깨졌다.** 같은 그림·같은 프롬프트·코멘트까지 같은데 60 과 35. 모델에게 다섯 항목을 더하게 시킨 것이 흔들림을 만들었다 — `temperature 0` 이어도 중간 산술이 끼면 결과가 갈린다.
- 압축이 심해졌다(25~35). `scatter` 25 ≈ `cat_no_tail` 30. v1 의 동점 문제가 해결되지 않았다.
- **교훈**: 합산은 모델에게 시키지 않는다. 항목별 점수가 필요하면 JSON 으로 받아 서버가 더한다. 다만 그 전에 모델 자체가 형태를 가르는지부터 봐야 한다 — `detail=low` 는 512px 리사이즈이고 원본이 512 라 정보 손실은 없다. 남은 변수는 모델이다.

#### 변별력 진단 v3 (같은 날, **`gpt-4o`**, v1 프롬프트 그대로, 6장)

| 그림 | 4o-mini v1 | **4o v1** | 기대 |
| --- | --- | --- | --- |
| `cat_best` | 80 | **90** | 90~100 ✅ |
| `cat_best_again` | 80 | **90** | 같음 ✅ |
| `cat_full` | 50 | 70 | 70~89 ✅ |
| `cat_no_tail` | 30 | **70** | 50~69 ✗ — `cat_full` 과 동점, 꼬리 없는 걸 안 깎음 |
| `cat_scrambled` | 30 | 30 | <50 ✅ |
| `scatter` | 30 | **30** | 0~9 ✗ — `cat_scrambled` 와 동점, 난수를 "동물 같다"고 봄 |

- 모델을 올리자 상단이 갈렸다: `best` 90 > `full` 70 > `scrambled` 30. 재현성도 유지.
- **`p_tok` 427** — `gpt-4o-mini`(3,175)의 1/7. mini 가 이미지 토큰에 큰 배수를 적용하는 것이 확인됐다. Credit 이 토큰 비례라면 4o 가 mini 보다 비싸지 않을 수 있다(T000c 로 확인).
- 남은 문제 둘은 **프롬프트 구조**다: 여전히 90/70/30 구간 대표값에 붙고, "부위가 빠지면 얼마까지" 가 명시돼 있지 않아 꼬리 없는 그림을 안 깎았다.

#### 변별력 진단 v4 (같은 날, `gpt-4o`, 부위 확인 + 빠진 부위별 상한 + "경계값 금지")

| 그림 | 4o v1 | **4o v4** | 코멘트 |
| --- | --- | --- | --- |
| `cat_best` | 90 | **85** | "모두 있으나 비율이 어색함" |
| `cat_best_again` | 90 | **95** | "모두 있어 고양이로 보임" — **같은 그림, 다른 판단** |
| `cat_full` | 70 | 85 | |
| `cat_no_tail` | 70 | **85** | "꼬리 모두 있음" — **없는 꼬리를 봤다** |
| `cat_scrambled` | 30 | **72** | "모두 있으나 비율이 어색함" — 배치 엉망을 못 봤다 |
| `scatter` | 30 | **8** | "닫힌 형태가 없어 무관" ✅ 규칙이 먹었다 |

- ✅ "닫힌 형태 없으면 ≤9" 는 먹는다. 난수가 바닥으로 갔다.
- ✗ **재현성이 또 깨졌다.** "구간 안에서 위치를 정하라·경계값을 쓰지 마라" 가 흔들림을 만든다. 숫자를 자유롭게 고르게 하면 `temperature 0` 이어도 결과가 갈린다. v2 의 합산과 같은 교훈 — **숫자 결정을 모델에게 맡기면 재현성이 없다.**
- ✗ **부위 환각.** 꼬리 없는 그림에 "꼬리 있음", 부위가 흩어진 그림에 "모두 제자리". 상한 규칙이 있어도 전제(부위 판정)가 틀리면 소용없다. 이건 채점 규칙이 아니라 **지각** 문제다.

네 번의 진단에서 나온 원칙:

| 관찰 | 원칙 |
| --- | --- |
| 구간만 주면 재현되지만 6개 값에 붙는다 (v1·v3) | 모델의 숫자 출력은 **범주**로만 믿는다 |
| 숫자를 자유롭게 고르게 하면 흔들린다 (v2·v4) | **점수 계산은 서버가 한다** — 모델은 부위 유무·배치·전체 인상을 범주로만 답한다 |
| 없는 꼬리를 본다 (v4) | 지각은 `detail`·모델·기준 그림으로만 좋아진다. 프롬프트 문구로는 안 된다 |
| mini 는 이미지 토큰 7배 (3,175 vs 427) | `gpt-4o` 로 간다. 토큰 기준이면 mini 보다 싸다 |

#### 변별력 진단 v5 (같은 날, `gpt-4o`, v4 프롬프트, **`detail=high`**)

| 그림 | 4o v4 (low) | **4o v5 (high)** |
| --- | --- | --- |
| `cat_best` | 85 | **거부** — `content: null`, `refusal: "I'm sorry, I can't assist…"` |
| `cat_best_again` | 95 | 95 |
| `cat_full` | 85 | 85 |
| `cat_no_tail` | 85 | **85** — 여전히 "꼬리 모두 있음" |
| `cat_scrambled` | 72 | **85** — 더 올라갔다 |
| `scatter` | 8 | 0 ✅ |

- **해상도는 답이 아니다.** `high` 로 올려도 없는 꼬리를 보고, 엉망 배치를 "모두 제자리" 라 한다. 토큰만 655→825.
- **새 실패 유형: 안전 거부.** 선 그림에도 드물게 붙는다. 운영 코드는 `content` null → `FAILED` → 재시도로 흡수되지만 `refusal` 을 로그에 남기도록 고쳤다(`GmsChatResponse.Message.refusal`).
- 프롬프트 문구·해상도로는 부위 지각을 못 고친다. 남은 레버는 **기준 그림(few-shot)** 이다 — 비교 대상이 있으면 "이 그림엔 저 꼬리가 없다" 가 보일 수 있다.

#### 변별력 진단 v6 (같은 날, `gpt-4o`, `detail=low`, **few-shot 기준 그림 4장**)

기준: `cat_full` 75 · `cat_no_tail` 55 · `cat_scrambled` 35 · `scatter` 5. 시험은 기준과 다른 계열(`cat_best` 변형 + 새 난수).

| 시험 그림 | 점수 | 기대 | 판정 |
| --- | --- | --- | --- |
| `cat_best` | 90 | 90~100 | ✅ |
| `cat_best_again` | **90** | 같음 | ✅ 재현 |
| `cat_best_no_tail` | **90** | 50~69 | ✗ "꼬리 모두 있음" — 55점 기준 그림을 옆에 보여줘도 |
| `cat_best_scrambled` | **35** | <50 | ✅ "머리와 몸통이 엉뚱함" — 이유까지 맞다 |
| `scatter2` | **5** | 0~9 | ✅ "기준 그림 4와 유사" |

`p_tok` 919 (이미지 5장). 5/6 통과. 기준 그림이 엉망 배치와 난수를 갈랐다 — 문구로는 안 됐던 것이다.

#### 결정 (2026-09-22, 실험 6회 · 약 500 Credit)

| 항목 | 결정 | 근거 |
| --- | --- | --- |
| 모델 | **`gpt-4o`** | mini 는 어떤 프롬프트로도 30점 동점 무더기 (v1·v2). 이미지 토큰도 mini 가 7배 |
| 프롬프트 | 6구간 앵커 + 빠진 부위별 상한 + 닫힌 형태 규칙 + **기준 그림 4장** (v6) | 유일하게 재현·순서·바닥을 동시에 만족 |
| `temperature` | 0 | 없으면 흔들린다 |
| 숫자 결정 | 모델에게 "구간 안 위치" 나 "합산" 을 시키지 않는다 | v2·v4 에서 재현성이 깨진 원인 |
| `detail` | low | high 는 토큰만 늘고 지각은 그대로 |
| 기준 그림 저장 | **`artwork` 행으로** (`is_anchor=true`, 점수 고정, 리더보드 제외) | 좌표 저장·렌더러를 그대로 재사용. 회차마다 SQL 로 넣는다 |

**알려진 한계**: 부위 하나(특히 꼬리)가 빠진 것을 못 깎는다. 6회 실험 전부 해당. 프롬프트·해상도·기준 그림 어느 것으로도 안 뚫렸다. 실제 제출물에서 "꼬리만 없는 완성형 고양이" 가 얼마나 나오는지 보고 다시 판단한다.

**비용**: 호출당 20 Credit. 회차당 1작품 + 재시도 3회 = 사용자당 최대 80 Credit, 100명이면 8,000. **팀 확인 필요.** mini(2 Credit)는 결과가 쓸 수 없어 대안이 아니다.

**T000c 정리**: Credit 이 정액이든 토큰 비례든 `gpt-4o` 쪽이 유리하다 — 정액이면 결과가 되는 유일한 선택이고, 토큰 비례면 mini 의 1/7 이다.

경로 `/v1/chat/completions` 는 어댑터가 갖는다 — base URL 에 넣지 않는다(`VideoIdApiClient` 가 base URL 과 `/videoid` 를 나눠 갖는 것과 같다).

**모델 선택 근거**: GMS 모델 목록에서 **이미지 입력이 명시된 것** 중 가장 싸다(2 Credit). "구조화된 출력 포함" 이라 `{score, comment}` JSON 강제가 되어 파싱 실패 경로가 줄어든다.

| 후보 | Credit | 이미지 입력 |
| --- | --- | --- |
| **`gpt-4o-mini`** | **2** | 명시 — "텍스트 및 이미지 입력 지원, 구조화된 출력 포함" |
| `gemini-3.5-flash` | 18 | 명시 — 멀티모달 |
| `gpt-4o` | 20 | 명시 — 텍스트·이미지·오디오 |
| `gpt-5.4-mini` | 14 | **없음** — 목록 설명에 멀티모달 언급 없음. 탈락 |

점수에 변별력이 없으면(전부 비슷한 값) `gpt-4o` 나 `gemini-3.5-flash` 로 올린다. 모델 id 가 설정값이라 **환경변수 교체 + 컨테이너 재시작**으로 끝나고 재배포가 필요 없다.

**비용 상한**: 회차당 1작품 + 재시도 3회 = 사용자당 최대 4회. 100명 기준 800 Credit.

**요청 형태 가정**: OpenAI 호환 `POST /v1/chat/completions`, 이미지 입력은 `content` 배열의 `image_url` 파트에 `data:image/png;base64,...`. 인증 헤더는 `Authorization: Bearer <key>` 로 가정한다. **프록시가 이미지 파트를 통과시키는지, 헤더 형식이 맞는지는 첫 호출로 확인한다**(tasks T000b). 틀리면 어댑터 한 클래스(`GmsEvaluationClient`)만 바뀐다 — 포트 인터페이스(`ArtworkEvaluationPort`)가 그 경계다.

**응답 파싱**: 모델에게 JSON 한 개만 답하라고 지시한다.

```json
{ "score": 0-100 정수, "comment": "한국어 한 줄" }
```

파싱 실패·`score` 범위 밖·`comment` 없음은 **전부 실패**로 본다(FR-006, spec US3-5). 모델이 뱉은 값을 검증 없이 쓰지 않는다.

## Constitution Check

*GATE: Phase 0 전 통과. 설계 후 재확인 — 동일.*

| 원칙 | 판정 | 근거 |
| --- | --- | --- |
| I. 명세 우선 | **조건부** | 이 기능은 FEATURES.md 에 없다. 스펙을 먼저 썼지만 **기획 확인 전에는 구현 착수 불가**다(spec "기능 명세와의 관계") |
| II. 계약 우선 | 통과 | API 계약을 아래 §API 계약 에 고정하고 프론트에 먼저 전달한다 |
| III. 완료 전 검증 | 통과 예정 | 스냅샷 불변·실패 처리·정렬·좋아요 멱등을 테스트로 고정. `./gradlew test` 통과가 완료 조건 |
| V. 좌표 안정성 | 통과 | 좌표를 다시 계산하지 않고 `ConstellationService` 가 낸 값을 **복사만** 한다. 작품은 `layout_version` 을 함께 기록해 어떤 baseline 의 모양인지 남긴다 |
| VII. 실험 격리 | 통과 | 모델 id·프롬프트를 작품 행에 기록해 어떤 모델이 준 점수인지 구분 가능하게 한다 |
| VIII. 관측 가능성 | 통과 | 아래 "확인할 지표" |
| IX. 암묵적 가정 금지 | 통과 | GMS 계약을 **미확인으로 표시**했다. 회차당 1작품 정책도 기획 확인 대상으로 남겼다 |
| X. 아키텍처 경계 | 통과 | 변경은 `backend/` 안. `frontend/`·`data/` 는 읽기만. 좌표는 `music` 도메인의 공개 서비스로만 얻는다 |

**확인할 지표**:
- `artwork` 상태별 행 수 — `PENDING` 이 계속 쌓이면 평가 루프가 죽은 것이다
- GMS 호출 수·실패 수·소요 시간 (로그. 새 미터는 실측 뒤에 정한다)
- 로그에 API 키·이미지 base64 를 찍지 않는다 (FR-016, 헌법 VIII)

## 데이터 모델

### 테이블

```sql
-- 회차. 행은 사람이 넣는다(자동 생성 스케줄러는 범위 밖).
artwork_round
  id           int8 PK        -- artwork_round_id_seq
  theme        varchar(50)    NOT NULL   -- '고양이'
  theme_prompt text           NOT NULL   -- AI 에게 줄 기준 문장. 회차마다 다르다
  starts_at    timestamptz    NOT NULL
  ends_at      timestamptz    NOT NULL
  created_at   timestamptz    NOT NULL DEFAULT now()

-- 작품 = 제출 시점 스냅샷 + 평가 결과.
artwork
  id             int8 PK      -- artwork_id_seq
  round_id       int8         NOT NULL  FK artwork_round(id)
  email          varchar(255) NOT NULL              -- 제출자
  playlist_id    int8         NULL                  -- 출처 기록용. FK 아님(원본이 지워져도 남는다, FR-004)
  title          varchar(100) NOT NULL              -- 제출 시점 플레이리스트 이름 복사
  layout_version varchar(50)  NOT NULL              -- 어떤 좌표 baseline 의 모양인지 (헌법 V)
  status         varchar(20)  NOT NULL              -- PENDING | SCORED | FAILED
  score          int4         NULL                  -- 0~100. 실패는 NULL 이지 0 이 아니다 (FR-006)
  ai_comment     text         NULL
  model          varchar(100) NULL                  -- 점수를 준 모델 id (헌법 VII)
  attempt_cnt    int4         NOT NULL DEFAULT 0    -- 상한 3 (FR-007)
  fail_reason    varchar(200) NULL                  -- 사람이 읽을 요약. 키·본문 금지
  like_cnt       int4         NOT NULL DEFAULT 0    -- artwork_like 의 집계 사본
  evaluated_at   timestamptz  NULL
  created_at     timestamptz  NOT NULL DEFAULT now()
  -- 회차당 1작품 (SC-005). 001 에서는 테이블 UNIQUE 였으나 002 에서 부분 유니크 인덱스로 바꿨다 —
  -- 기준 그림(is_anchor) 4장이 같은 시스템 email 로 들어가기 때문이다. 사람에게는 그대로 걸린다.
  -- CREATE UNIQUE INDEX uq_artwork_round_email ON artwork (round_id, email) WHERE is_anchor = false

-- 스냅샷 좌표. 작품당 2~30행. playlist_item 과 같은 모양.
artwork_point
  artwork_id int8       NOT NULL  FK artwork(id) ON DELETE CASCADE
  position   int4       NOT NULL  -- 0부터. 제출 시점 곡 순서
  music_id   int8       NOT NULL  -- FK 아님: 곡이 지워져도 그림은 남는다
  x          float8     NOT NULL  -- -1 ~ 1
  y          float8     NOT NULL
  PRIMARY KEY (artwork_id, position)

-- 좋아요. playlist_like 를 그대로 베꼈다.
artwork_like
  artwork_id int8         NOT NULL  FK artwork(id) ON DELETE CASCADE
  email      varchar(255) NOT NULL
  created_at timestamptz  NOT NULL DEFAULT now()
  PRIMARY KEY (artwork_id, email)     -- 동시 클릭에도 1 만 오른다 (SC-006)
```

### 인덱스

```sql
-- 리더보드 정렬 그대로. WHERE status='SCORED' 부분 인덱스로 PENDING·FAILED 를 빼 둔다.
CREATE INDEX ix_artwork_leaderboard ON artwork (round_id, score DESC, like_cnt DESC, created_at ASC)
  WHERE status = 'SCORED';

-- 평가 대상 뽑기.
CREATE INDEX ix_artwork_pending ON artwork (created_at) WHERE status = 'PENDING';

-- 내 작품 목록.
CREATE INDEX ix_artwork_email ON artwork (email, created_at DESC);

-- "내가 좋아요한 작품" — playlist_like 와 같은 이유(PK 가 artwork_id 로 시작한다).
CREATE INDEX ix_artwork_like_email ON artwork_like (email, created_at DESC);
```

### 왜 좌표를 저장하나 (곡 id 만 두고 다시 계산하지 않는 이유)

같은 곡 집합이면 같은 좌표가 나오므로(헌법 V) 곡 id 만 저장해도 그림을 복원할 수 있다. 그래도 저장하는 이유:
**점수는 그 그림에 매겨진 것**이다. 좌표 baseline 이 바뀌면 곡 id 만 든 작품은 모양이 조용히 달라지고, 옛 점수가 새 그림에 붙는다. 작품당 최대 30행이라 비용은 무시할 수 있다.

## API 계약

전부 `ApiResponse{success,data,error}` 봉투. 인증은 기존과 같이 Bearer.

| 메서드 | 경로 | 인증 | 설명 |
| --- | --- | --- | --- |
| `GET` | `/api/artwork/round/current` | 불필요 | 열린 회차. 없으면 `data: null` |
| `POST` | `/api/artwork/submit` | 필요 | 플레이리스트를 작품으로 제출 |
| `GET` | `/api/artwork/leaderboard` | 선택 | 회차 리더보드 (`SCORED` 만) |
| `GET` | `/api/artwork/detail` | 선택 | 작품 상세 |
| `GET` | `/api/artwork/mine` | 필요 | 내 작품(모든 상태) |
| `POST` | `/api/artwork/like` | 필요 | 좋아요 목표 상태 변경 |
| `POST` | `/api/artwork/retry/{artworkId}` | 필요 | 실패 작품 재평가 |
| `DELETE` | `/api/artwork/{artworkId}` | 필요 | 작품 삭제 |

인증 "선택" 은 비로그인도 볼 수 있다는 뜻이며, 로그인 상태면 `likedByMe` 가 채워진다.

### `POST /api/artwork/submit`

```jsonc
// 요청
{ "playlistId": 12 }            // roundId 는 받지 않는다 — 항상 "지금 열린 회차"다

// 201
{ "success": true, "data": { "artworkId": 501, "status": "PENDING" }, "error": null }
```

| 상황 | 상태 | code |
| --- | --- | --- |
| 열린 회차 없음 | 409 | `ARTWORK_ROUND_CLOSED` |
| 남의 플레이리스트 | 403 | `FORBIDDEN` |
| 곡 수 2 미만 / 30 초과 | 400 | `INVALID_INPUT` |
| 없는 플레이리스트 | 404 | `PLAYLIST_NOT_FOUND` (기존 코드 재사용) |
| 곡 좌표를 못 만듦 | 404 | `MUSIC_NOT_FOUND` (배치 API 규칙 그대로) |

**같은 회차 재제출은 오류가 아니다.** 기존 작품을 지우고 새로 만든다(점수·좋아요 소멸, spec Clarifications).

### `GET /api/artwork/leaderboard?roundId={id}&page={n}&size={m}`

`roundId` 생략 시 열린 회차. `size` 기본 20·최대 50.

```jsonc
{ "success": true, "data": {
  "round": { "roundId": 1, "theme": "고양이", "startsAt": "...", "endsAt": "..." },
  "items": [
    { "artworkId": 501, "rank": 1, "title": "밤산책", "ownerEmail": "a@b.c",
      "score": 87, "aiComment": "귀 두 개와 꼬리가 또렷하다.",
      "likeCnt": 12, "likedByMe": false, "musicCnt": 14, "createdAt": "..." }
  ],
  "page": 0, "size": 20, "totalCnt": 137 } , "error": null }
```

`rank` 는 서버가 정렬 순서대로 매긴다(동점도 다른 등수 — 정렬 키가 3단이라 순서가 확정된다).

### `GET /api/artwork/detail?artworkId={id}`

```jsonc
{ "success": true, "data": {
  "artworkId": 501, "roundId": 1, "theme": "고양이",
  "title": "밤산책", "ownerEmail": "a@b.c", "mine": false,
  "status": "SCORED", "score": 87, "aiComment": "...",
  "likeCnt": 12, "likedByMe": false,
  "points": [ { "musicId": 900, "x": -0.42, "y": 0.13 } ],     // 제출 순서
  "musics": [ { "musicId": 900, "title": "...", "artist": "..." } ],  // points 와 같은 순서
  "createdAt": "...", "evaluatedAt": "..." }, "error": null }
```

- `status` 가 `PENDING`·`FAILED` 인 작품은 **소유자에게만** 200 이고, 남에게는 `404 ARTWORK_NOT_FOUND` 다 (FR-009). 존재 여부를 흘리지 않으려고 403 이 아니라 404 를 쓴다.
- `FAILED` 는 `score`·`aiComment` 가 `null` 이고 `failReason` 이 함께 온다.

### `POST /api/artwork/like`

```jsonc
{ "artworkId": 501, "liked": true }
// 200
{ "success": true, "data": { "artworkId": 501, "liked": true, "likeCnt": 13 }, "error": null }
```

`PlaylistController#changeLike` 와 같은 규칙 — 토글이 아니라 목표 상태라 반복해도 결과가 같다.

### `POST /api/artwork/retry/{artworkId}` · `DELETE /api/artwork/{artworkId}`

둘 다 소유자만. 재평가는 `FAILED` 에서만 가능하고 `attempt_cnt >= 3` 이면 거부한다.

### 신규 에러 코드 — `ArtworkErrorCode`

| code | HTTP | 언제 |
| --- | --- | --- |
| `ARTWORK_NOT_FOUND` | 404 | 없는 작품, 또는 남의 미채점 작품 |
| `ARTWORK_ROUND_CLOSED` | 409 | 열린 회차가 없다 |
| `ARTWORK_NOT_FAILED` | 409 | 실패가 아닌 작품에 재평가 요청 |
| `ARTWORK_RETRY_EXHAUSTED` | 409 | 재시도 3회 소진 |

`FORBIDDEN`·`INVALID_INPUT`·`NOT_FOUND` 는 `GlobalErrorCode` 를, `PLAYLIST_NOT_FOUND` 는 `PlaylistErrorCode` 를 그대로 쓴다. **프론트 `src/types/api.ts` 에 위 4개를 추가해야 한다.**

## 평가 흐름

제출은 행만 만들고 끝난다. 평가는 스케줄러가 한다.

```text
POST /submit
  └ 트랜잭션: (기존 작품 삭제) → artwork INSERT(PENDING) → artwork_point INSERT
  └ 201 반환. 여기서 GMS 를 부르지 않는다 (FR-013)

ArtworkEvaluationScheduler  @Scheduled(fixedDelay)
  └ PENDING 을 N건 집는다  (SELECT ... WHERE status='PENDING' ORDER BY created_at LIMIT N FOR UPDATE SKIP LOCKED)
  └ ArtworkRenderer      : artwork_point → BufferedImage → PNG bytes
  └ ArtworkEvaluationPort: PNG + theme_prompt → {score, comment}   (구현체 GmsEvaluationClient)
  └ 성공: status=SCORED, score, ai_comment, model, evaluated_at, attempt_cnt+1
     실패: status=FAILED, fail_reason, attempt_cnt+1   (score 는 건드리지 않는다 = NULL 유지)
  └ 작품 행이 이미 지워졌으면 아무것도 쓰지 않는다 (UPDATE 가 0행이면 끝)
```

**`@Async` 대신 스케줄러를 쓰는 이유**: `@Async` 는 코드가 더 짧지만 서버가 재시작하면 진행 중이던 `PENDING` 이 영영 멈춘다. 스케줄러는 같은 코드로 최초 평가·재시도·재시작 복구를 모두 덮는다. `FOR UPDATE SKIP LOCKED` 로 인스턴스가 늘어도 같은 작품을 두 번 평가하지 않는다.

`@EnableScheduling`·`@EnableAsync` 는 `RealtimeTaskConfig` 에 이미 있다 — 설정 추가 없음.

### 이미지 렌더 (`ArtworkRenderer`)

- 512×512 PNG, 검은 배경, 점은 흰 원, 이웃한 `position` 끼리 흰 선으로 잇는다(프론트 별자리와 같은 규칙: 여정·플리 모두 순서대로 연결 — PATH-01).
- `x`·`y` 는 -1~1 → 여백 8% 를 남기고 픽셀로 매핑. `y` 는 위가 양수이므로 뒤집는다.
- **같은 좌표 입력이면 같은 바이트**가 나와야 한다(테스트로 고정). 시간·난수·글꼴을 쓰지 않는다 — 글자를 그리지 않으므로 서버 글꼴에 의존하지 않는다.
- `java.awt` 는 headless 로 동작한다. 컨테이너 실행에 `-Djava.awt.headless=true` 를 명시한다.

## Project Structure

```text
backend/src/main/java/com/ssafy/backend/artwork/
├── controller/ArtworkController.java
├── dto/            (요청·응답 record — submit / leaderboard / detail / like / round)
├── mapper/ArtworkMapper.java          ArtworkRoundMapper.java     ArtworkLikeMapper.java
├── service/ArtworkService.java        ArtworkLikeService.java     ArtworkEvaluationService.java
├── scheduler/ArtworkEvaluationScheduler.java
├── render/ArtworkRenderer.java
└── evaluation/ArtworkEvaluationPort.java   GmsEvaluationClient.java   GmsChatResponse.java

backend/src/main/java/com/ssafy/backend/common/ArtworkErrorCode.java
backend/src/main/resources/mapper/artwork/*.xml
backend/src/main/resources/db/artwork_001_tables.sql
```

`music/`(좌표)·`playlist/`(소유권 확인)는 **읽기만** 한다 — 각 도메인의 공개 서비스 메서드로만 부른다(헌법 X).

## 위험과 대응

| 위험 | 대응 |
| --- | --- |
| GMS 계약 가정이 틀리다 | 어댑터 한 클래스로 격리(`ArtworkEvaluationPort`). 구현 전 실물 호출 1회로 확인 |
| 모델이 매번 다른 점수를 준다 | 같은 작품을 다시 평가하지 않는다(성공하면 끝). 재평가는 실패 때만 |
| `PENDING` 적체 | 상태별 행 수를 본다. 스케줄러 배치 크기·주기는 설정값 |
| 이미지가 LLM 이 읽기엔 너무 성기다 | 점 크기·선 두께를 설정으로 빼고 실측으로 조정. 프롬프트도 회차 행(`theme_prompt`)에 있어 코드 배포 없이 고친다 |
| 비용 | 회차당 1작품 + 재시도 3회 = 사용자당 최대 4회 |

## 검증

```bash
cd backend
./gradlew test
./gradlew build
```

DDL 은 사람이 DBeaver 로 실행한다. 실행 전후로 `SELECT count(*) FROM artwork` 가 성립하는지 확인한다.
