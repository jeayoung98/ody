# Quickstart: 작품 순위·좋아요 3표 검증

## 로컬

```bash
cd backend && ./gradlew test && ./gradlew build
```

테스트가 보장하는 것 (tasks 에서 작성):

- 순위: 좋아요 0 → AI 순, 좋아요 1 추가 → 그 작품만 +1, 동점 → AI → 먼저 낸 순 (SC-001·003).
- 표: 4번째 누름 → `ARTWORK_VOTE_LIMIT`, 하나 거둔 뒤 성공, 내 작품 → `ARTWORK_VOTE_SELF`, 닫힌 회차 → `ARTWORK_ROUND_CLOSED`, 같은 요청 반복 → 표 안 늘어남.
- closed: 출품 true → 행에 true, 렌더러에 닫는 선(마지막→첫 점 픽셀), 기본 false. 기존 렌더 바이트 테스트 불변.
- 리더보드 곡 이름: 페이지당 좌표 조회 1회·곡 이름 조회 1회.

## 운영 (배포 전 DDL → 배포 → 확인)

1. `artwork_003_ranking_votes.sql` 적용 → `\d artwork_round` 에 `vote_limit`·`ai_weight`, `\d artwork` 에 `closed`.
2. 배포 후 (토큰은 환경변수로만):
   - `GET /api/artwork/round/current` → `voteLimit: 3`, `myVotesLeft` 숫자.
   - 남의 작품 3개 좋아요 → 4번째 409 `ARTWORK_VOTE_LIMIT`. 하나 거두고 다시 → 200. 정리로 거둔다.
   - 리더보드 → `rankScore` 내림차순, 항목마다 `points`(제목·가수).
   - K 변경 확인: `UPDATE artwork_round SET ai_weight = 10 WHERE id = <현재>` → 재시작 없이 리더보드 `rankScore` 가 바뀜 → 5 로 되돌림. (**운영 DB 쓰기 — 사람이 실행**)
3. 동시성(SC-002)은 운영에서 재현하지 않는다 — 단위 테스트 + 락 SQL 리뷰로 본다.
