# Implementation Plan: 작품 리더보드 순위(AI + 좋아요)와 회차당 좋아요 3표

**Branch**: `backend/feat/S15P21A405-616-artwork-ranking-vote-limit` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-artwork-ranking-votes/spec.md`

## Summary

563 `artwork` 모듈 안에서 끝낸다. 리더보드 정렬을 `좋아요 + AI×K/100` 으로 바꾸고, 좋아요에 회차당 한도·내 작품 금지·닫힌 회차 차단을 넣고, 닫힌 모양 칸과 리더보드 곡 목록을 더한다. K 와 한도는 **회차 행의 칸**이라 DB UPDATE 로 바꾼다(배포·재시작 없음). 새 테이블·새 의존성 없음. DDL 은 기본값 있는 칸 3개.

## Technical Context

**Language/Version**: Java 17, Spring Boot 4.1

**Primary Dependencies**: Spring Web·Validation, MyBatis — 기존

**Storage**: PostgreSQL — `artwork_round` +2칸, `artwork` +1칸 (research R1·R7). `pg_advisory_xact_lock` 사용(R3)

**Testing**: JUnit 5 + Mockito (`ArtworkServiceTests`, `ArtworkRendererTests` 패턴)

**Target Platform**: 운영 Docker Blue-Green. DDL 은 배포 전 수동 적용(563 관례)

**Project Type**: web-service (백엔드)

**Performance Goals**: 리더보드 한 페이지 = 기존 쿼리 + 좌표 1회 + 곡 이름 1회

**Constraints**: 동시 좋아요에서도 회차 한도 초과 0건(SC-002). 기존 FE 호환(필드 추가만)

**Scale/Scope**: 회차당 작품 수백 개 수준

## Constitution Check

| 원칙 | 판정 | 근거 |
| --- | --- | --- |
| I 명세 우선 | ✅ | spec + 기획(효정) 결정 2026-09-23. FEATURES 에는 #36(FE 콘테스트) 제안이 있음 → 순위·표 규칙을 거기 덧붙인다(tasks) |
| II 계약 우선 | ✅ | [contracts/artwork-api-delta.md](./contracts/artwork-api-delta.md). 필드 추가 + 정렬·거절 동작 변경 → BACKEND-NOTES §6 갱신, FE 통보 |
| III 검증 | ✅ | 순위·표·closed·렌더 단위 테스트, `./gradlew test build`, quickstart |
| IV 재현성 | ✅ 해당 적음 | DDL 파일로 남김 |
| V 좌표 | ✅ | 좌표 규칙 변경 없음 |
| VIII 관측 | ✅ | 좋아요 로그에 `votesUsed` 추가, 거절 사유 로그 |
| IX 가정 금지 | ✅ | 경합·닫힌 회차·기존 초과분 처리 research 에 근거 |
| X 경계 | ✅ | `artwork` 안. `MusicDetailReader` 는 이미 주입돼 있음 |

재평가(Phase 1 후): 변동 없음.

## 설계

### 변경 파일

| 파일 | 변경 |
| --- | --- |
| `backend/src/main/resources/db/artwork_003_ranking_votes.sql` (신규) | 칸 3개 (data-model) |
| `artwork/dto/ArtworkRoundRow.java` · `ArtworkRound.java` | `voteLimit`, `aiWeight`(row) / `voteLimit`, `myVotesLeft`(응답) |
| `artwork/dto/ArtworkRow.java` · `ArtworkSubmitRequest.java` | `closed` / `Boolean closed`(선택) |
| `artwork/dto/ArtworkSummaryRow.java` · `ArtworkSummary.java` | `rankScore`, `closed` / + `points` |
| `artwork/dto/ArtworkTrack.java` (신규) | `{musicId, title, artist, x, y}` — 598 `/draw` 결과도 같이 쓴다(`DrawTrack` 을 합침) |
| `artwork/dto/ArtworkDetailResponse.java` | `closed`, `tracks`(`ArtworkTrack` — 좌표+곡 이름, 기존 `points`·`musics` 는 호환 유지) |
| `resources/mapper/artwork/ArtworkMapper.xml` + `ArtworkMapper.java` | 회차 칸 조회, `insertArtwork` closed, `artworkColumns` closed, 리더보드 정렬·`rank_score`, `findPointsByArtworkIds`, `countVotesInRound`, `lockVotes` |
| `common/ArtworkErrorCode.java` | `ARTWORK_VOTE_LIMIT`(409), `ARTWORK_VOTE_SELF`(400) |
| `artwork/service/ArtworkService.java` | `changeLike` 검사·락·한도, `findOpenRound(email)` 남은 표, `submit(closed)`, 리더보드 `points` 조립 |
| `artwork/controller/ArtworkController.java` | `round/current` 에 인증 주체 전달, submit 에 closed |
| `artwork/render/ArtworkRenderer.java` · `service/ArtworkEvaluationService.java` | `render(points, closed)` 오버로드, 채점 시 closed 전달 |
| 테스트 | `ArtworkServiceTests`·`ArtworkRendererTests` 확장 |
| 문서 | BACKEND-NOTES §6 갱신(§6-9 델타), FEATURES #36 에 순위·표 규칙 |

### 좋아요 흐름 (R3·R5)

```text
changeLike(artworkId, liked, email)   @Transactional (기존)
  → 작품 없음/남의 미채점 → ARTWORK_NOT_FOUND (기존)
  → 작품 주인 == email      → ARTWORK_VOTE_SELF
  → 작품 회차 != 열린 회차   → ARTWORK_ROUND_CLOSED
  → liked == true 이고 아직 안 누름:
       pg_advisory_xact_lock(hashtext(email:roundId))
       countVotesInRound(email, roundId) >= vote_limit → ARTWORK_VOTE_LIMIT
  → insert/delete like, like_cnt ±1 (기존)
```

이미 누른 작품에 `liked=true` 를 다시 보내면 한도 검사 없이 멱등 성공(기존 동작 유지).

## Project Structure

```text
specs/011-artwork-ranking-votes/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/artwork-api-delta.md
├── checklists/requirements.md
└── tasks.md   # /speckit-tasks
```

**Structure Decision**: `artwork` 모듈 안. 새 패키지·클래스는 `ArtworkTrack` 하나.

## 배포 순서

1. `artwork_003_ranking_votes.sql` 운영 적용 (기본값이 있어 기존 코드 무해)
2. 배포
3. quickstart 운영 확인

## Complexity Tracking

위반 없음.
