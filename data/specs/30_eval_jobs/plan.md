# 30 평가 잡 — plan

- `scripts/eval_all.py <bundle>`: 기존 검증 스크립트를 함수 호출로 감싸 결과 dict 수집 → `output/eval/<version>.json` + md 렌더. 각 스크립트가 파일 경로 상수를 쓰므로 `SERV` 인자를 받도록 최소 수정(동작 변경 없음, 골든 비교로 확인).
- 청취 채점: `output/qual_scores.csv` 있으면 `qual_eval_summary` 결과 병합.
- 실행 시간: gate2 재채점 ≈ 10분, Hit@10 1,000 쿼리 ≈ 2분, MLHD 1M 표본 ≈ 5분.
- 리스크: 스크립트들이 `work/` 대용량에 의존 → CI 는 요약 JSON 만 비교하는 경량 모드.
