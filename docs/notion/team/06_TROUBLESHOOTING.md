# 증상별 1차 대응

## API 502/504

app-node에서 Nginx active port, `docker ps`, 해당 port health, Nginx error log를 확인합니다.
active port와 running container가 다르면 최근 Jenkins 배포 로그를 봅니다.

## Backend DOWN

active container의 `docker logs --tail 200 <name>`을 확인합니다. image tag, exit code, health를 기록합니다.
무조건 container를 삭제하지 않습니다.

## Jenkins 실패

- 실패 Stage와 build number
- Java 17 Test 실패인지
- Docker build인지
- SSH/image load인지
- app `backend/deploy.sh`인지
- 최종 Verify인지

를 구분합니다.

## Webhook 실패

master Nginx `nginx -t`, access/error log, Jenkins service를 확인합니다. 외부 `/` 404는 정상입니다.
Webhook exact path의 POST만 허용됩니다.

## DataNode 누락

`hdfs dfsadmin -report`, 양쪽 `jps`, DataNode log와 disk를 확인합니다. NameNode format이나 data directory 삭제를
하지 않습니다.

## NodeManager 누락

`yarn node -list -all`, 해당 node `jps`, NodeManager log, `/data/hadoop/yarn` disk를 확인합니다.

## HDFS replication warning

파일의 requested replication과 Live DataNode 수를 비교합니다. 과거 MapReduce staging 파일이 replication 10으로
생성된 이력이 있으며 현재 설정은 `mapreduce.client.submit.file.replication=2`입니다. 오래된 staging 파일인지
확인 없이 HDFS 데이터를 삭제하지 않습니다.

## Spark Job 실패

YARN application/container log에서 driver와 executor 오류를 구분합니다. OOM이면 collect, partition skew,
executor memory/overhead 순으로 확인하고 작은 샘플로 재현합니다.

## Blue-Green switch 실패

target container health, `/etc/nginx/sites-available/backend`, `nginx -t`, deploy log를 확인합니다.
기존 container가 살아 있으면 upstream이 기존 port로 rollback됐는지 먼저 확인합니다.

## 도움을 요청할 때 남길 정보

- 발생/확인 시각
- 서버 hostname
- 최근 배포 build number/commit
- 실행한 명령과 출력
- 관련 로그 200줄 이내
- 사용자 영향

token, password, private key, Authorization header는 공유하지 않습니다.
