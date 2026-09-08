# ODY 인프라 한눈에 보기

## 서버는 두 대입니다

| 서버 | 쉽게 말하면 | 주요 역할 |
|---|---|---|
| master-node | 관리/데이터 처리/배포 서버 | Hadoop/YARN 관리자, Spark, Jenkins, Prometheus/Grafana |
| app-node | 서비스/작업 실행 서버 | Backend, Nginx, PostgreSQL, Neo4j, Hadoop/YARN worker |

## 전체 그림

```text
사용자
  |
  | HTTPS
  v
app-node Nginx
  |
  +--> Blue Backend  (127.0.0.1:8081)
  +--> Green Backend (127.0.0.1:8082)
       둘 중 하나만 실제 요청을 받음

       +--> PostgreSQL (서비스 원본 데이터)
       +--> Neo4j (graph projection)
       두 DB는 private Docker network 전용, host port 없음

Git push
  -> GitLab webhook
  -> master-node Jenkins
  -> 테스트와 Docker image 생성
  -> app-node 전달
  -> Blue/Green 교체

대용량 음악 데이터
  -> HDFS (master/app 두 DataNode)
  -> Spark submit (master)
  -> YARN이 master/app에 계산 작업 분배
```

## Backend 요청 흐름

사용자는 8081이나 8082에 직접 접속하지 않습니다. `j15a405.p.ssafy.io`의 Nginx가 현재 활성 Backend로
보냅니다. 새 버전은 비활성 port에서 먼저 시작되고 health가 확인된 뒤 트래픽을 받습니다.

## Hadoop 데이터 흐름

NameNode는 파일의 위치 정보를 master-node에서 관리합니다. 실제 block은 master-node와 app-node의
DataNode에 replication 2로 저장됩니다. 한 노드의 DataNode가 빠지면 데이터 복제 상태가 나빠질 수 있으므로
`hdfs dfsadmin -report`와 `hdfs fsck /`를 확인합니다.

## Spark 처리 흐름

Spark 명령은 master-node에서 제출하지만 YARN이 master-node와 app-node 양쪽 NodeManager에 executor를
배치할 수 있습니다. Spark가 master 한 대에만 설치돼 있어도 분산 계산이 가능합니다.

## CI/CD 흐름

```text
master branch push
-> Jenkins Checkout
-> Java 17 Gradle Test
-> backend:<build-number> Docker image
-> app-node docker load
-> backend/deploy.sh
-> inactive Backend health
-> Nginx switch
-> 최종 health
```

## Monitoring

master의 Prometheus/Grafana와 두 node의 Node Exporter가 동작합니다. Prometheus의 node-master,
node-app, spring-backend target이 모두 UP이며 Grafana에서 서버 자원, Backend JVM/HTTP/Hikari를 봅니다.
