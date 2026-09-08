# 남은 인프라/운영 과제

인프라 구축, HTTPS, Monitoring, DB persistence/restore, k6와 순차 reboot recovery는 완료됐다.
현재 남은 것은 제품 개발과 장기 운영 정책이다.

- Entity/schema 도입 전 Flyway/Liquibase 및 migration/runtime role 분리
- PostgreSQL→Neo4j projection 동기화와 재생성 ADR
- backup off-host 암호화 보관, retention 자동화와 RPO/RTO
- 중앙 로그, Prometheus alert와 알림 채널
- 실제 제품 API 기반 k6 목표 부하/합격 기준
- Frontend hosting/deployment와 환경 분리
- Repository Notion Markdown의 실제 Notion page 반영

서버 재구축이 필요해지면 현재 Repository에 삭제된 provisioning 파일을 복원한다고 가정하지 않는다.
별도 백업과 당시 운영 서버 configuration을 조사해 새로운 구축 계획을 수립한다.
