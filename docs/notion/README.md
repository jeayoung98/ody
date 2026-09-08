# ODY Infrastructure Notion Pages

이 디렉터리는 Notion에 그대로 복사할 수 있는 운영 문서다.

- `team/`: 모든 팀원이 보는 개념과 1차 확인 가이드
- `owner/`: 인프라 담당자가 구축, 변경, 복구할 때 사용하는 상세 문서

기술 설정의 Source of Truth는 `docs/infra/`와 `infra/`다. Notion에서 내용을 수정했다면 같은 변경을
Repository 원본에도 반영한다. 실제 서버 적용 여부는 `docs/infra/STATUS.md`를 기준으로 확인한다.

2026-09-07 기준 PostgreSQL/Neo4j, Backend DB 연결, Monitoring, k6, HTTPS/Certbot과 순차 reboot 복구까지
검증 완료했다. Repository는 최초 provisioning 파일을 제거하고 반복 운영 도구와 현재 상태 문서만
관리한다. 상세 상태는 `docs/infra/STATUS.md`를 따른다.
