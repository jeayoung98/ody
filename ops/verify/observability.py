#!/usr/bin/env python3
"""Read-only checks for live metrics, bounded URI labels and the Grafana dashboard."""
import base64
import json
from pathlib import Path
import urllib.parse
import urllib.request

def get(url, auth=None):
    req = urllib.request.Request(url)
    if auth:
        req.add_header("Authorization", "Basic " + base64.b64encode(auth.encode()).decode())
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.load(response)

def query(expr):
    result = get("http://127.0.0.1:9090/api/v1/query?" + urllib.parse.urlencode({"query": expr}))
    assert result["status"] == "success"
    return result["data"]["result"]

for metric in ("http_server_requests_seconds_bucket", "jvm_memory_used_bytes", "hikaricp_connections_active"):
    assert query(metric + '{service="backend"}'), "Missing live data: " + metric
series = query('http_server_requests_seconds_count{service="backend"}')
uris = {s["metric"].get("uri", "") for s in series}
assert len(uris) <= 30, "Unexpected HTTP URI cardinality"
assert all(not any(part.isdigit() for part in uri.split("/")) for uri in uris), "Raw numeric ID URI"
values = dict(line.split("=", 1) for line in Path("/etc/ody/monitoring.env").read_text().splitlines() if line and not line.startswith("#"))
auth = values["GRAFANA_ADMIN_USER"] + ":" + values["GRAFANA_ADMIN_PASSWORD"]
assert get("http://127.0.0.1:3000/api/datasources/uid/prometheus/health", auth)["status"] == "OK"
dashboard = get("http://127.0.0.1:3000/api/dashboards/uid/ody-infra-overview", auth)
assert len(dashboard["dashboard"]["panels"]) >= 14
print("PASS: Prometheus live HTTP/JVM/Hikari, bounded URI labels, Grafana datasource and dashboard")
