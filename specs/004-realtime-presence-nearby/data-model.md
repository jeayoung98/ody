# Data Model: 실시간 Presence · 화면 사용자 · 근처 사람 · 만난 횟수

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-09-10

두 층으로 나뉜다. **Redis**(휘발·TTL·인덱스 — 실시간 진실)와 **PostgreSQL**(영속 — 재생 기록·만남·곡 좌표·사용자).
Redis 키 조립은 `*RedisRepository`에만 존재한다. 식별자는 서버 내부 email, 화면 노출은 nickname + imageUrl(FR-030).

## 1. Redis

### 1.1 Presence (사용자 1명당)

| 키 | 타입 | 필드/멤버 | TTL | 소유 |
| --- | --- | --- | --- | --- |
| `presence:user:{email}` | Hash | `epoch`(long) · `layer`(int) · `musicId`(long, 없으면 필드 부재 = 비노출) · `x`,`y`(double 0~1) · `cellX`,`cellY`(int) · `connectedAt` | **없음** — 만료는 ZSET이 관리 | PresenceRedisRepository |
| `presence:expiry` | ZSET | member = email, score = expiresAt(epoch ms) | — | 〃 |

- 하트비트: `ZADD presence:expiry XX {now+45000} {email}` (존재할 때만 갱신).
- Sweep: `ZRANGEBYSCORE presence:expiry -inf {now}` → 각 email에 `presence-leave.lua`.
- `epoch`는 재접속마다 +1. `presence-leave.lua`는 인자 epoch와 Hash epoch가 같을 때만 정리한다(새 세션이 이미 덮어썼으면 no-op).

**상태 전이**

```
(없음) --CONNECT--> 비노출{musicId 부재} --join(복원)/play--> 노출{musicId} --play--> 노출{musicId'}
노출/비노출 --leave|onClose|expiry--> (없음)
노출 --viewport(layer 변경)--> 노출{같은 musicId, layer'·cell' 재계산}
```

### 1.2 곡 청취자 · 셀 인덱스 · 셀 인원수 (RT-02·23)

| 키 | 타입 | 멤버/필드 | 불변식 |
| --- | --- | --- | --- |
| `listeners:{musicId}` | Set | email | 사용자는 정확히 0 또는 1개 Set의 멤버. `presence.musicId == m ⇔ email ∈ listeners:{m}` |
| `active-song:cell:{layer}:{cellX}:{cellY}` | Set | musicId | `m ∈ cell ⇔ ∃ e ∈ listeners:{m} with presence.layer == layer` — 즉 "이 레이어·셀에 청취자가 있는 곡" |
| `cell:usercount:{layer}` | Hash | field `"{cellX}:{cellY}"` → count | `count == Σ_{m ∈ cell} |{e ∈ listeners:{m} : presence.layer == layer}|`. 0이면 필드 삭제. **Lua 안에서만 갱신** |

- 한 사용자는 **현재 레이어 하나**의 셀에만 인덱싱된다(spec Assumptions). 레이어 이동 시 구레이어 셀에서 빼고 신레이어 셀에 넣는다.
- 셀 좌표: `cellX = min(floor(x_norm × 16), 15)`, 음수 → 0. 격자 16은 yml.
- `usercount-recount.lua` / Sweep 60s가 불변식 3을 검증·복구한다.

### 1.3 구독 인덱스 · 메타 (RT-11·22)

| 키 | 타입 | 멤버/필드 | 의미 |
| --- | --- | --- | --- |
| `viewport:cell:{layer}:{cellX}:{cellY}` | Set | email | **이 셀을 보고 있는** 사람(시선). INDIVIDUAL 모드만 |
| `viewport:meta:{email}` | Hash | `layer` · `minX,maxX,minY,maxY`(원시 pc) · `bounds`(JSON `[{axis,min,max}]`) · `cellKeys`(JSON `[]`) · `mode` | 수신자 검사(FR-058)와 해제(FR-063)의 근거 |
| `nearby:subscribers:{musicId}` | Set | email | 이 곡의 청취자 변동을 듣는 사람 |
| `nearby:meta:{email}` | Hash | `anchor`(musicId) · `musicIds`(JSON `[]`, anchor 포함 K+1) | 해제(FR-077)·앵커 변경 감지(FR-076)의 근거 |

- 해제는 **항상 meta의 저장 목록**으로만 한다. 격자·K·캐시가 바뀌어도 누수 없음.
- leave/expiry 시 meta 2종을 읽어 4종 인덱스에서 제거 후 meta DEL(FR-021).

### 1.4 캐시 (프로세스 내, 상한형)

| 캐시 | 키 → 값 | 무효화 |
| --- | --- | --- |
| 곡 좌표 | musicId → double[16] (또는 null = location NULL) | 데이터셋 버전 승격 시 전체 플러시. 크기 상한(초기 100k) |
| 곡 메타 | musicId → (title, artist) | 〃 |
| 이웃곡 | (musicId, k) → List<(musicId, distance)> | 〃 (FR-078 불변) |
| 사용자 표시 | email → (nickname, imageUrl) | 프로필 변경 이벤트 없음 → TTL 5분(BE1 `user/update`와 협의 — B-2) |

Redis가 아니라 프로세스 내인 이유: 값이 불변(좌표·이웃)이거나 지연 허용(표시명)이고, 다중화 시에도 인스턴스별 캐시로 충분하다.

## 2. PostgreSQL

ERD 실물 대조는 B-2. 아래는 정본(Notion)과 기존 `UserMapper.xml`에서 확인된 범위.

### 2.1 `"user"` (BE1 소유 — 읽기만)

| 컬럼 | 확인 근거 | 이번 기능의 사용 |
| --- | --- | --- |
| `email` (식별자) | UserMapper.xml `findByEmail`, JWT subject | 내부 식별자. **payload 금지** |
| `nickname` (NULL·중복 가능) | UserMapper.xml, RT-90 비고 | 표시용. NULL이면 FE가 대체 표시(FE 협의) |
| `image_url` | UserMapper.xml | 표시용 |
| `is_public` (기본 TRUE) | RT-90 비고 "ERD user.is_public 존재" | MVP 미사용(Q3). `filterVisible` 지점만 |

### 2.2 `play_history` (BE3 쓰기 — 컬럼은 B-2 확인)

| 컬럼 (예상) | 제약 | 쓰는 곳 |
| --- | --- | --- |
| `id` PK | | `/music/play` INSERT 반환 → `playHistoryId` |
| `email` FK → user | NOT NULL | 소유자 검증(FR-018) |
| `music_id` FK → music | NOT NULL | |
| `source` | `MAP/JOURNEY/PLAYLIST/FOLLOW` (ERD `play_history.source` 4종과 일치) | |
| `played_ms` | NOT NULL, 시작 시 0 | `/music/play/end` UPDATE(멱등) |
| `played_at` | 기본 now() | join 복원 시 `ORDER BY played_at DESC LIMIT 1` |

- 인덱스 필요: `(email, played_at DESC)` — 복원 조회. **[요청: BE1]**
- 동시성: 같은 사용자의 `/music/play` 연타는 행이 여러 개 쌓이는 것이 정상(RT-02 "재선언도 새로 쌓는다").

### 2.3 `meeting` (BE3 쓰기 — RT-50 "ERD 그대로, 스키마 변경 요청 없음")

| 컬럼 | 제약 | 비고 |
| --- | --- | --- |
| `user1` FK → user.email | `user1 < user2` (사전순) | 애플리케이션이 정렬 보장 |
| `user2` FK → user.email | | |
| `cnt` | NOT NULL DEFAULT 0 | UPSERT +1 |
| `(user1, user2)` | **UNIQUE 필요** — ON CONFLICT 절의 전제 | B-2 확인. 없으면 BE1에 추가 요청 |

- `last_met_at` 없음(dedup 없음 — FR-083).
- UPSERT: `INSERT INTO meeting(user1,user2,cnt) VALUES (...),(...) ON CONFLICT (user1,user2) DO UPDATE SET cnt = meeting.cnt + 1`.

### 2.4 `music` (BE2/BE4 소유 — 포트 경유 읽기만)

| 컬럼 | 사용 |
| --- | --- |
| `id` | |
| `location VECTOR(16)` | PC1~16 원시값. NULL → 지도 밖(`PRESENCE_ERROR`). 정규화는 표시용만 |
| `title`, `artist` | 근처 스냅샷 그룹 헤더 |
| (`youtube_url`) | 이번 기능 무관 — FE가 재생 불가 표시 |

접근은 `MusicDetailReader`(기존) 또는 경량 좌표 포트(R-03 제안)로만. BE3가 `music` 매퍼를 직접 만들지 않는다.

## 3. 검증 규칙 요약 (FR ↔ 자료구조)

| 규칙 | 검사 위치 |
| --- | --- |
| `source ∈ {MAP,JOURNEY,PLAYLIST,FOLLOW}` | DTO `@Pattern` / enum 바인딩 → `VALIDATION_ERROR` |
| 곡 존재·`location` NOT NULL | 좌표 포트 결과 → `MUSIC_NOT_FOUND` / `PRESENCE_ERROR` |
| `layer` 존재 | `RealtimeProperties.layers` 조회 → `PRESENCE_ERROR` |
| `minX < maxX`, `minY < maxY`, `bounds` 비어있지 않음 | `ViewportRequest` 검증 → `PRESENCE_ERROR` |
| 앵커 존재 | `presence.musicId` 부재 → `PRESENCE_ERROR` |
| `playHistory.email == token.email` | `PlayHistoryMapper.updatePlayedMs(id, email, ms)` affected rows == 0 → `FORBIDDEN` (존재하지 않는 id도 동일 코드 — 존재 유무 노출 안 함) |
| old `musicId` 일치 (Sweep 경쟁) | `presence-play.lua` 반환 -1 → `PRESENCE_ERROR` |
| epoch 일치 (구세션 정리) | `presence-leave.lua` 반환 0 → no-op |

## 4. 지표 (FR-090) — Micrometer 이름 제안

| 지표 | 타입 | 태그 |
| --- | --- | --- |
| `realtime.sessions.active` | Gauge | — |
| `realtime.presence.visible` | Gauge | layer |
| `realtime.play.latency` | Timer | outcome(ok/nop/error) |
| `realtime.delta.fanout.size` | DistributionSummary | kind(viewport/nearby) |
| `realtime.delta.latency` | Timer | kind — PositionChanged 발생 → 개인 큐 발행까지 |
| `realtime.sweep.expired` | Counter | — |
| `realtime.recount.mismatch` | Counter | layer |
| `realtime.meeting.batch.size` | DistributionSummary | — |
| `realtime.normalize.clamped` | Counter | axis — B-4 임의 상수 부적합 탐지 |

email·토큰은 태그·로그 어디에도 넣지 않는다.
