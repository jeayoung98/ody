# ODY 운영 체크리스트

## 서버 재부팅 전

- [ ] 실행 중 HDFS/YARN/Spark job 확인
- [ ] HDFS report/fsck HEALTHY 확인
- [ ] Backend active slot/image 확인
- [ ] systemd unit 설치/enable과 기존 daemon 중복 여부 확인
- [ ] reboot 대상과 rollback/접속 경로 확인

## 서버 재부팅 후

- [ ] `hostname`, `date`, `uptime`, disk/memory
- [ ] `jps` role별 daemon
- [ ] Live DataNode 2 / FSCK HEALTHY
- [ ] RUNNING NodeManager 2
- [ ] app Nginx와 active Backend health
- [ ] Jenkins와 webhook Nginx
- [ ] Monitoring containers와 target 3개 UP
- [ ] PostgreSQL/Neo4j/Backend dependencies health UP

## 배포 전

- [ ] branch/commit 확인
- [ ] DB migration 유무(현재 schema migration 없음)
- [ ] immutable image tag와 `ody-internal` network
- [ ] rollback 가능한 이전 image tag
- [ ] app disk/image 여유
- [ ] Jenkins 동시 build 없음

## 배포 후

- [ ] Jenkins 모든 Stage 성공
- [ ] active port/container/image 일치
- [ ] internal/Nginx `/actuator/health` UP
- [ ] `/api/hello` 또는 핵심 API 정상
- [ ] container restart/로그 이상 없음
- [ ] Grafana 5xx/p95/JVM/Hikari 확인
- [ ] PostgreSQL/Neo4j container health

## Hadoop/MapReduce job 전

- [ ] Live DataNode 2 / replication 상태
- [ ] RUNNING NodeManager 2
- [ ] HDFS/YARN disk 여유
- [ ] staging replication 설정 2
- [ ] input/output path와 권한

## Spark job 전

- [ ] master-node에서 제출
- [ ] 작은 샘플 성공
- [ ] schema와 expected row count
- [ ] partition/resource 계획
- [ ] Backend load test와 동시 실행 여부 기록

## Spark job 후

- [ ] YARN final state SUCCEEDED
- [ ] failed task/executor 없음
- [ ] output row count/schema/null/duplicate/NaN 검증
- [ ] shuffle/spill/skew/memory 기록
- [ ] staging/temporary output 상태 확인

## Monitoring 확인

- [ ] Prometheus ready
- [ ] node-master target UP
- [ ] node-app target UP
- [ ] spring-backend target UP
- [ ] Grafana datasource/dashboard 정상
- [ ] 3000/9090 public 비공개

## 부하 테스트 전

- [ ] 변경 commit/image와 baseline 기록
- [ ] smoke 성공
- [ ] target/threshold/duration 승인
- [ ] Prometheus/Grafana 정상
- [ ] 동시 Spark/YARN job 여부 통제

## 부하 테스트 후

- [ ] p50/p95/p99/throughput/error 저장
- [ ] host/JVM/HTTP metric 같은 시간대 저장
- [ ] container/Jenkins/HDFS/YARN 이상 없음
- [ ] 테스트 데이터와 임시 resource 정리 범위 검토
- [ ] 다음 re-test 조건 기록

## 장애 발생 시

- [ ] 영향/시작 시각/최근 변경
- [ ] 증거 보존 후 사용자 영향 완화
- [ ] proxy/app/data cluster 경계 분리
- [ ] rollback 기준 확인
- [ ] secret 없는 incident timeline 작성
