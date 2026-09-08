# Observability

master-node에서 Prometheus 3.14.0, Grafana 13.2.0, Node Exporter 1.12.1이 운영 중이고 app-node에서도
Node Exporter 1.12.1이 운영 중이다.

```text
Prometheus -> master/app private Node Exporter
           -> app HTTPS Nginx /actuator/prometheus -> active Blue/Green
Grafana    -> Prometheus
```

Prometheus/Grafana는 loopback, Node Exporter는 private IP에만 bind한다. app actuator는 localhost와
master private IP만 허용한다.

Dashboard는 host CPU/memory/disk/network, HTTP rate/p50/p95/p99/5xx, JVM heap/GC/thread/CPU,
Hikari active/pending을 포함한다. raw ID를 Micrometer URI label로 추가하지 않는다.

```bash
sudo bash ops/verify/monitoring.sh
```

runtime 검증은 container health, 세 Prometheus target, HTTP/JVM/Hikari live series, URI cardinality,
Grafana datasource와 dashboard를 읽기 전용으로 확인한다. 관리 UI는 SSH tunnel을 사용한다.

```bash
ssh -L 3000:127.0.0.1:3000 ubuntu@j15a405a.p.ssafy.io
```

Repository의 `observability/dashboards/ody-overview.json`은 dashboard 변경 검토용 reference다.
Monitoring Compose/provisioning은 서버에 적용 완료되어 Repository에서 재설치하지 않는다. DB exporter는
운영 복잡도 때문에 추가하지 않았고 container health, host resource, Hikari metric으로 관측한다.
