# ODY 인프라 구축 이력

2026-09-07 기준 다음 구성이 완료됐다.

```text
2-node Hadoop/YARN -> Spark on YARN
-> Backend Docker/Blue-Green/Nginx
-> Jenkins/GitLab webhook CI/CD
-> PostgreSQL Source of Truth + Neo4j projection
-> Prometheus/Grafana/Node Exporter
-> k6 smoke/load/zero-downtime
-> HTTPS/Certbot renew dry-run
-> app/master 순차 reboot recovery
```

주요 운영 결정:

- HDFS replication과 MapReduce staging replication은 2 DataNode에 맞춰 2다.
- Jenkins runtime은 Java 21, Backend build/Hadoop/Spark는 Java 17이다.
- registry 없이 build-number image를 `docker save | SSH | docker load`로 전달한다.
- Backend와 DB는 `ody-internal` network로 연결하고 DB host port를 열지 않는다.
- PostgreSQL은 Source of Truth, Neo4j는 재생성 가능한 graph projection이다.

구축 완료 후 Repository는 서비스 개발 중심으로 정리했다. 서버 최초 설치에 사용한 Hadoop/Spark XML,
systemd unit, Nginx/production Compose template과 install/rollout 스크립트는 제거했다. CI/CD, local,
k6, runtime verify, backup/restore, dashboard reference와 운영 문서는 유지한다.
