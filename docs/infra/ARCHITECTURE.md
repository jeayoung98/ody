# ODY Infrastructure Architecture

```text
GitLab -> master HTTPS Nginx -> Jenkins
       -> Gradle test -> Docker build/save/SSH
       -> app deploy.sh -> inactive slot health -> Nginx switch
       -> npm ci/lint/test/build -> dist archive/SSH
       -> app deploy-frontend.sh -> release validation -> atomic symlink switch

Client HTTPS -> app Nginx -> /                 -> /var/www/ody/current (SPA)
                          -> /api              -> backend-blue/green
                          -> /actuator         -> existing restricted policy
                              +-> PostgreSQL (Source of Truth)
                              +-> Neo4j (graph projection)

Prometheus/Grafana(master) -> master/app Node Exporter
                           -> Spring Actuator/Micrometer

HDFS: master NameNode + master/app DataNode, replication 2
YARN: master ResourceManager + master/app NodeManager
Spark: master client -> YARN executors
```

## 경계

| Node | 실행 항목 |
|---|---|
| master-node | NN/DN/SNN, RM/NM, Spark, Jenkins, webhook Nginx, Prometheus, Grafana, Node Exporter |
| app-node | DN/NM, HTTPS Nginx, Frontend static releases, Backend Blue-Green, PostgreSQL, Neo4j, Node Exporter |

Backend 8081/8082, Jenkins 8080, Prometheus 9090, Grafana 3000은 loopback이다. Node Exporter는 private
network에만 노출한다. PostgreSQL 5432와 Neo4j 7474/7687은 host에 publish하지 않고 `ody-internal`
Docker network에서 Backend와 통신한다.

두 node는 각각 4 vCPU/약 15 GiB RAM이다. YARN, API, DB와 배포/관측 workload가 자원을 공유하므로
대규모 Spark job, Jenkins build와 성능 테스트의 동시 실행을 피하고 host/JVM/Hikari metric을 확인한다.

서버 configuration은 운영 서버가 기준이다. Repository에는 provisioning template 대신 반복 운영 도구,
로컬 환경, 성능 시나리오와 dashboard reference만 유지한다.
