#!/usr/bin/env python3
"""Single entry point for local PostgreSQL, Redis, Neo4j, and Backend work."""

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
ENV_FILE = ROOT / ".env.local"
EXAMPLE = ROOT / ".env.local.example"
COMPOSE = ROOT / "infra" / "local" / "docker-compose.yml"
REQUIRED = {
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "APP_DB_PASSWORD",
    "REDIS_PASSWORD",
    "NEO4J_PASSWORD",
    "SPRING_DATASOURCE_URL",
    "SPRING_DATASOURCE_USERNAME",
    "SPRING_DATASOURCE_PASSWORD",
    "SPRING_DATA_REDIS_HOST",
    "SPRING_DATA_REDIS_PORT",
    "SPRING_DATA_REDIS_PASSWORD",
    "NEO4J_URI",
    "NEO4J_USERNAME",
}


def load_env():
    if not ENV_FILE.is_file():
        raise SystemExit("Missing .env.local; run: python scripts/local/dev.py init")
    values = {}
    for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator:
            raise SystemExit(f"Invalid .env.local line for key: {key}")
        values[key.strip()] = value.strip()
    missing = sorted(key for key in REQUIRED if not values.get(key))
    placeholders = sorted(key for key, value in values.items() if "CHANGE_ME" in value)
    if missing or placeholders:
        raise SystemExit(f"Invalid .env.local; missing={missing}, placeholders={placeholders}")
    return values


def compose(values, *args, capture=False):
    command = ["docker", "compose", "--env-file", str(ENV_FILE), "-f", str(COMPOSE), *args]
    return subprocess.run(
        command,
        cwd=ROOT,
        env={**os.environ, **values},
        check=True,
        capture_output=capture,
        text=capture,
    )


def service_check(values, service, *command, expected):
    result = compose(values, "exec", "-T", service, *command, capture=True)
    output = result.stdout.strip()
    if expected not in output:
        raise SystemExit(f"{service} validation failed: expected {expected!r}")
    print(f"PASS: {service}: {expected}")


def validate_services(values):
    service_check(
        values,
        "postgres",
        "pg_isready",
        "-U",
        values["POSTGRES_USER"],
        "-d",
        values["POSTGRES_DB"],
        expected="accepting connections",
    )
    service_check(
        values,
        "redis",
        "sh",
        "-c",
        'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping',
        expected="PONG",
    )
    service_check(
        values,
        "neo4j",
        "sh",
        "-c",
        'NEO4J_PASSWORD="${NEO4J_AUTH#*/}"; cypher-shell -u neo4j -p "$NEO4J_PASSWORD" "RETURN 1 AS result;"',
        expected="1",
    )


def initialize():
    if ENV_FILE.exists():
        print(".env.local already exists; it was not overwritten")
        return
    shutil.copyfile(EXAMPLE, ENV_FILE)
    print("Created .env.local with development-only credentials.")


def reset(values):
    if not sys.stdin.isatty():
        raise SystemExit("reset requires an interactive terminal; no data was removed")
    phrase = "DELETE LOCAL DATA"
    print("WARNING: this removes all ODY local PostgreSQL, Redis, and Neo4j data volumes.")
    try:
        confirmation = input(f"Type {phrase!r} to continue: ").strip()
    except EOFError:
        confirmation = ""
    if confirmation != phrase:
        raise SystemExit("Reset cancelled; no data was removed")
    compose(values, "down", "--volumes", "--remove-orphans")
    print("Removed local containers, network, and data volumes.")


def run_backend(values):
    validate_services(values)
    wrapper = BACKEND / ("gradlew.bat" if os.name == "nt" else "gradlew")
    command = [str(wrapper), "bootRun", "--args=--spring.profiles.active=local"]
    subprocess.run(command, cwd=BACKEND, env={**os.environ, **values}, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "action",
        choices=("init", "check", "up", "down", "status", "reset", "backend", "start", "stop", "run"),
    )
    action = parser.parse_args().action

    if action == "init":
        initialize()
        return

    values = load_env()
    if action == "check":
        compose(values, "config", "--quiet")
        print("PASS: local environment and Compose configuration")
    elif action in ("up", "start"):
        compose(values, "up", "-d", "--wait")
        validate_services(values)
        compose(values, "ps")
    elif action in ("down", "stop"):
        compose(values, "down")
        print("Local data volumes were preserved. Use reset only when data deletion is intentional.")
    elif action == "status":
        compose(values, "ps", "--all")
    elif action == "reset":
        reset(values)
    else:
        run_backend(values)


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
