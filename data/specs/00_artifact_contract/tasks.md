# 00 서빙 아티팩트 계약 — tasks

| # | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| T1 | `tests/check_contract.py` 작성 (spec §필수 파일·manifest·버전 규칙) | `python tests/check_contract.py serving/v2.1-pca16` exit 0, WARN 만 | ✅ |
| T2 | `serving/CURRENT.json` 생성 (v2.1) | 파일 존재, 검사기가 읽음 | ✅ |
| T3 | `tests/test_contract.py` (CURRENT 번들 non-strict 통과) + 커밋 훅 연결 | `pytest -q tests` 통과, `git commit` 시 훅 실행 로그 | ✅ |
| T4 | `scripts/artifact_finalize.py` (files 해시·catalog_sha256·contract_version·created_at 기록) | v2.2 manifest 에 키 존재 | ⬜ (09-08) |
| T5 | v2.2 생성 후 `--strict --prev serving/v2.1-pca16` 통과 (AC2, AC3) | exit 0 | ⬜ (09-08) |
| T6 | CURRENT → v2.2 스위치 + 롤백 리허설(v2.1 로 되돌리고 API 재기동) | 두 번 모두 5 엔드포인트 응답 | ⬜ (09-13) |
