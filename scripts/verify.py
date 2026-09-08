#!/usr/bin/env python3
"""Continuous development/runtime verification. Exit 0=PASS, 1=FAIL, 2=NOT RUN."""

import argparse
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
RESULTS = []
EXCLUDED_PARTS = {".git", ".gradle", "build", "dist", "node_modules", "coverage", "__pycache__"}
BASH = shutil.which("bash")
if os.name == "nt" and Path("C:/Program Files/Git/bin/bash.exe").exists():
    BASH = "C:/Program Files/Git/bin/bash.exe"


def record(name, status, detail=""):
    RESULTS.append((name, status))
    print(f"{status}: {name}" + (f" ({detail})" if detail else ""))


def run(name, args, env=None, timeout=180, input_text=None):
    executable = str(args[0])
    if not shutil.which(executable) and not Path(executable).exists():
        record(name, "NOT RUN", "tool unavailable")
        return
    try:
        result = subprocess.run(
            args, cwd=ROOT, env=env, capture_output=True,
            encoding="utf-8", errors="replace", timeout=timeout, input=input_text,
        )
        status = "PASS" if result.returncode == 0 else "FAIL"
        record(name, status)
        if status == "FAIL":
            print((result.stdout + result.stderr)[-3000:])
    except subprocess.TimeoutExpired:
        record(name, "FAIL", "bounded timeout")


def check(name, function):
    try:
        function()
        record(name, "PASS")
    except Exception as exc:
        record(name, "FAIL", str(exc))


def files_under(*roots):
    for relative in roots:
        path = ROOT / relative
        if path.is_file():
            yield path
        elif path.is_dir():
            yield from (
                item for item in path.rglob("*")
                if not EXCLUDED_PARTS.intersection(item.parts) and item.is_file()
            )


def local():
    shell_files = sorted(
        list(files_under("deploy.sh", "deploy-frontend.sh", "ops", "infra/local")),
        key=lambda path: str(path),
    )
    for path in (item for item in shell_files if item.suffix == ".sh"):
        run(str(path.relative_to(ROOT)), [BASH or "bash", "-n", str(path)])

    python_files = sorted(
        (item for item in files_under("scripts", "ops") if item.suffix == ".py"),
        key=lambda path: str(path),
    )
    for path in python_files:
        check(
            "Python syntax " + str(path.relative_to(ROOT)),
            lambda path=path: compile(
                path.read_text(encoding="utf-8"), str(path), "exec"
            ),
        )

    for path in files_under("observability"):
        if path.suffix == ".json":
            check(str(path.relative_to(ROOT)), lambda path=path: json.loads(path.read_text(encoding="utf-8")))

    def dashboard_contract():
        dashboard = json.loads((ROOT / "observability/dashboards/ody-overview.json").read_text(encoding="utf-8"))
        assert len(dashboard.get("panels", [])) >= 14, "expected at least 14 panels"
    check("Grafana dashboard contract", dashboard_contract)

    wrapper = ROOT / ("gradlew.bat" if os.name == "nt" else "gradlew")
    run("Gradle tests and Spring YAML", [str(wrapper), "test", "--no-daemon"], timeout=300)

    def secret_scan():
        bad = re.compile(
            r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|"
            r"glpat-[A-Za-z0-9_-]{15,}|AKIA[A-Z0-9]{16}"
        )
        for path in files_under("src", "frontend", "infra", "ops", "scripts", "docs", "observability"):
            if "__pycache__" not in path.parts:
                assert not bad.search(path.read_text(errors="replace")), (
                    "credential pattern in " + str(path.relative_to(ROOT))
                )
    check("secret patterns (values suppressed)", secret_scan)

    def reference_contract():
        removed = re.compile(
            r"infra/(?:hadoop|spark|systemd|nginx|monitoring|database|scripts)(?:/|\b)"
        )
        for path in files_under(
            "Jenkinsfile", "Jenkinsfile.frontend", "deploy.sh", "deploy-frontend.sh", "scripts", "src"
        ):
            assert not removed.search(path.read_text(errors="replace").replace("\\", "/")), (
                "removed provisioning path referenced by " + str(path.relative_to(ROOT))
            )
    check("CI/CD and application reference contract", reference_contract)

    for jenkinsfile in (ROOT / "Jenkinsfile", ROOT / "Jenkinsfile.frontend"):
        for index, block in enumerate(re.findall(r"'''(.*?)'''", jenkinsfile.read_text(encoding="utf-8"), re.S), 1):
            run(
                f"{jenkinsfile.name} shell block {index}",
                [BASH or "bash", "-n"],
                input_text=block,
            )

    run("git diff --check", ["git", "diff", "--check"])
    compose_env = dict(
        os.environ,
        POSTGRES_DB="ody",
        POSTGRES_USER="ody_owner",
        POSTGRES_PASSWORD="config-check-only",
        APP_DB_PASSWORD="config-check-only",
        REDIS_PASSWORD="config-check-only",
        NEO4J_PASSWORD="config-check-only",
    )
    compose = ROOT / "infra/local/docker-compose.yml"
    run(
        "Local Compose",
        ["docker", "compose", "-f", str(compose), "config", "--quiet"],
        compose_env,
    )

    frontend = ROOT / "frontend"
    run(
        "Frontend install, lint, test and build",
        [
            "docker", "run", "--rm",
            "-v", str(frontend) + ":/workspace",
            "-w", "/workspace",
            "node:24.20.0-bookworm-slim",
            "sh", "-euc", "npm ci && npm run lint && npm test && npm run build",
        ],
        timeout=360,
    )

    nginx_fixture = ROOT / "ops/tests/fixtures/frontend-nginx.conf"
    nginx_locations = ROOT / "docs/infra/examples/frontend-nginx.locations.conf"
    run(
        "Frontend Nginx routing reference",
        [
            "docker", "run", "--rm",
            "-v", str(nginx_fixture) + ":/etc/nginx/nginx.conf:ro",
            "-v", str(nginx_locations) + ":/etc/nginx/snippets/frontend-nginx.locations.conf:ro",
            "nginx:1.28.0-alpine", "nginx", "-t",
        ],
        timeout=180,
    )

    run(
        "cluster verification regressions",
        [sys.executable, "-m", "unittest", "discover", "-s", "ops/tests", "-p", "test_*.py"],
        env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"),
    )


def infra():
    for path in sorted((ROOT / "infra/k6").glob("*.js")):
        run(
            "k6 inspect " + path.name,
            [
                "docker", "run", "--rm",
                "-v", str(ROOT / "infra/k6") + ":/scripts:ro",
                "grafana/k6:2.2.0", "inspect", "/scripts/" + path.name,
            ],
        )


def role(name):
    if socket.gethostname().split(".")[0] != name + "-node":
        record(name, "NOT RUN", "SSH is not implicit")
        return

    scripts = ["docker.sh", "cluster.sh"]
    scripts += ["backend.sh", "postgres.sh", "neo4j.sh"] if name == "app" else ["cicd.sh"]
    scripts += ["monitoring.sh"]
    for script in scripts:
        path = ROOT / "ops/verify" / script
        prefix = ["sudo", "-n", "-u", "ubuntu"] if script == "cluster.sh" else ["sudo", "-n"]
        if script == "cicd.sh":
            run(
                script,
                ["sudo", "-n", "-u", "jenkins", "bash", "-s"],
                input_text=path.read_text(encoding="utf-8"),
                timeout=60,
            )
        else:
            run(script, prefix + ["bash", str(path)], timeout=240)

    services = ["nginx", "docker", "hadoop-datanode", "yarn-nodemanager"]
    if name == "master":
        services += ["jenkins", "hadoop-namenode", "hadoop-secondarynamenode", "yarn-resourcemanager"]
    for service in services:
        run("systemd " + service, ["systemctl", "is-active", "--quiet", service])


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    for mode in ("local", "infra", "master", "app", "all"):
        parser.add_argument("--" + mode, action="store_true")
    args = parser.parse_args()
    if args.local or args.all:
        local()
    if args.infra or args.all:
        infra()
    if args.master:
        role("master")
    if args.app:
        role("app")
    if args.all:
        host = socket.gethostname().split(".")[0]
        if host in ("master-node", "app-node"):
            role(host.split("-")[0])
    if not RESULTS:
        parser.error("select --local, --infra, --master, --app or --all")
    print(json.dumps({"results": [{"check": name, "status": status} for name, status in RESULTS]}, indent=2))
    raise SystemExit(
        1 if any(status == "FAIL" for _, status in RESULTS)
        else 2 if any(status == "NOT RUN" for _, status in RESULTS)
        else 0
    )
