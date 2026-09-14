# Specification Quality Checklist: 실시간 Presence · 화면 사용자 · 근처 사람 · 만난 횟수

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-10
**Feature**: [spec.md](../spec.md)

## Content Quality

- [ ] No implementation details (languages, frameworks, APIs) — **부분 미충족**: FR-012·013·024·060·064가 Redis 연산(SADD/SREM/HGETALL/Lua 원자 단위)을 직접 언급한다. 정본(Notion RT-xx)이 동작 순서를 Redis 연산 단위로 규정하고 있어 그대로 옮겼다. 추상화하면 정본과 어긋나므로 의도적으로 남긴다.
- [x] Focused on user value and business needs — US1~4가 "내 위치가 된다 / 화면 안 사람 / 비슷한 음악 듣는 사람 / 함께 들은 횟수"로 사용자 관점 서술
- [ ] Written for non-technical stakeholders — FR 절은 백엔드 협의용 정밀도로 작성됨. US·SC 절은 비기술 독자 가능.
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — Q1~Q3 전부 2026-09-10 사용자 확정으로 해소(Q1: join=배치·복원, play=이동의 유일 원본).
- [x] Requirements are testable and unambiguous — 모든 FR이 A-시나리오 1개 이상에 연결됨
- [x] Success criteria are measurable — SC-001~010 전부 수치·건수
- [ ] Success criteria are technology-agnostic — SC-004(Redis 잔여 키), SC-005(Hash/Set 일치)가 저장소 구조를 언급. 정본이 정합성 검증을 Redis 자료구조 단위로 요구해 남김.
- [x] All acceptance scenarios are defined — A1~A13, A20~A30, A40~A45, A50~A54 (32건)
- [x] Edge cases are identified — 8건
- [x] Scope is clearly bounded — 반응·따라가기 제외 명시, RT-90 제외 명시
- [x] Dependencies and assumptions identified — Assumptions 11항목

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [ ] No implementation details leak into specification — 위 Content Quality 1항과 동일 사유

## Notes

- 미충족 4항 중 3항은 **정본의 서술 수준**(Redis 연산 단위)에서 비롯한다. 정본을 추상화해 옮기는 것은 헌법 IX(암묵적 가정 금지)에 어긋나므로 그대로 두고 이 항목에 기록한다.
- Q1~Q3 해소됨(2026-09-10). 남은 확인은 Notion 「남은 협의」 4건과 Assumptions(join musicId 대조 방어 등).
- **정본 간 충돌 발견** (spec 작성 중 확인, 별도 처리 필요):
  1. Notion `/music/play` + `/music/play/end` ↔ BACKEND-NOTES A-7 — **Notion 우선 확정**, BACKEND-NOTES 갱신 필요(T082)
  2. Notion RT-90 "비공개 MVP 제외" ↔ 요구사항 §6 — **Notion 우선 확정**, 요구사항 쪽에 MVP 제외 표기 필요(기획)
  3. Notion WS 기반 화면 사용자·근처 사람 ↔ BACKEND-NOTES A-3 `GET /api/users/nearby?layer=`·A-4 `viewingMusicId` (FE가 REST를 기대) — FE2·FE1에 알려야 함
  4. Notion RT-50 "중복 방지 없음" ↔ 기존 스캐폴딩 `encounter-dedup.lua`(24h dedup) — 스캐폴딩이 구버전 설계
  5. Notion Heartbeat/TTL/Sweep 15/45/5s ↔ 기존 `application-realtime.yml` 25/60/30s — 스캐폴딩이 구버전 설계
  6. FEATURES.md에 RT-xx ID 부재 — 기획 확인 후 추가 필요 (spec §대응표 참조)
