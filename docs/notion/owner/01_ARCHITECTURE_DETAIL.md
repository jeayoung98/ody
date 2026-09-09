# ODY 상세 인프라 Architecture

| Node | Private | Public domain | 역할 |
|---|---|---|---|
| master-node | 172.26.15.14 | j15a405a.p.ssafy.io | HDFS/YARN control+worker, Spark, Jenkins, webhook Nginx, Prometheus/Grafana/Exporter |
| app-node | 172.26.14.216 | j15a405.p.ssafy.io | HDFS/YARN worker, HTTPS Nginx, Backend Blue-Green, PostgreSQL, Neo4j, Exporter |

```text
GitLab -> master HTTPS webhook -> Jenkins
       -> Java 17 test/build -> Docker save/SSH/load
       -> app backend/deploy.sh -> inactive health -> Nginx switch

Client HTTPS -> active Backend -> PostgreSQL source of truth
                              -> Neo4j graph projection

Prometheus -> two Node Exporters + Spring metrics -> Grafana
Spark client(master) -> YARN -> master/app executors -> HDFS
```

8081/8082, 8080, 9090, 3000은 loopback이다. 9100은 private network다. PostgreSQL/Neo4j는 host port 없이
`ody-internal` network에서만 Backend와 통신한다. credential은 `/etc/ody/*.env`, certificate는
`/etc/letsencrypt`, backup은 `/var/backups/ody-infra`에 있고 Git에 저장하지 않는다.

Hadoop/Spark/systemd/Nginx/DB/Monitoring configuration은 서버에 적용 및 reboot 검증 완료됐다. 실제 서버가
configuration 기준이며 Repository는 이를 재설치하지 않는다. 반복 점검/백업/복원은 `ops/`, local
dependency는 `infra/local`, 성능 시나리오는 `infra/k6`를 사용한다.
