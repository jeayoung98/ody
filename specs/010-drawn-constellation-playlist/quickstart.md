# Quickstart: 그린 별자리 매칭 검증

## 로컬

```bash
cd backend && ./gradlew test && ./gradlew build
```

테스트가 보장하는 것 (tasks 에서 작성):

- 점수: 같은 도형을 이동·회전(임의 각)·확대(0.5~2배) → 점수 차 ≤ 1 (SC-003). 좌우 반전 → 점수 하락.
- 단계: 기준 도형 + 잡음 σ 0.05 / 0.2 / 0.5 → HIGH / MEDIUM / LOW.
- 매칭: 곡 중복 없음 · 점 수 = 곡 수 · 순서 유지 (SC-002) · 같은 입력 → 같은 결과 (FR-012).
- 입력: 2개·21개 → 400 `INVALID_INPUT`, 한 점에 몰림 → 400 `ARTWORK_DRAWING_DEGENERATE`.
- 템플릿 `generate` 기존 테스트 그대로 통과 (리팩터로 동작이 안 바뀜).

## 운영 (배포 후, 토큰 필요 — 값은 환경변수로만)

```bash
API=https://j15a405.p.ssafy.io/api
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -X POST -d '{"points":[{"x":0.2,"y":0.8},{"x":0.5,"y":0.2},{"x":0.8,"y":0.8}]}' "$API/artwork/draw"
```

기대:

1. `200`, `points` 3개, `musicId` 서로 다름, `quality` 가 `HIGH`(실측 fitError 기준 대부분 점수 ~100).
2. 같은 `musicId` 로 `POST $API/constellations/layout` → 같은 좌표.
3. 같은 요청 두 번 → 같은 응답.
4. 배포 직후 **첫** 요청도 1 s 안 (R4 예열). 컨테이너 로그에 `[Artwork] 상자 예열` 이 기동 직후 찍힌다.
5. `docker logs backend-* | grep '그림 매칭'` 에 `score`·`ms` 가 남는다.
