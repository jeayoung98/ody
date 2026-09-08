# Jenkins/GitLab CI/CD 내부 구조

## Trigger와 인증

GitLab Repository는 HTTPS와 Jenkins credential store의 Access Token을 사용한다. GitLab SSH 22는 사용하지 않는다.
Webhook은 `https://j15a405a.p.ssafy.io/project/backend-pipeline`로 POST한다.

master Nginx는 exact webhook path만 Jenkins `127.0.0.1:8080`으로 proxy한다. Jenkins UI는 public route가 없고
관리자는 SSH tunnel을 사용한다.

## Jenkinsfile Stage

1. Checkout: `checkout scm`; URL/credential은 Job의 SCM 설정
2. Test: Java 17 `JAVA_HOME`, Wrapper `clean test`
3. Build Docker Image: `backend:${BUILD_NUMBER}`
4. Transfer Image: `docker save` stdout을 Jenkins SSH로 app `docker load`
5. Deploy: app Repository의 `./backend/deploy.sh backend:${BUILD_NUMBER}`
6. Verify: app localhost Nginx의 `/actuator/health`, status UP 본문 확인
7. Post: master의 build image만 삭제, 실패는 배포 결과를 가리지 않음

`disableConcurrentBuilds()`는 동시에 두 `backend/deploy.sh`가 active/target port를 계산하는 문제를 방지한다.

## Java 분리

```text
Jenkins JVM: Java 21
Pipeline Backend Gradle: Java 17
Hadoop/YARN/Spark: Java 17
```

Pipeline에서 `/usr/lib/jvm/java-17-openjdk-amd64`를 명시하고 version 17을 검사한다.

## SSH

- key: `/var/lib/jenkins/.ssh/app_deploy`
- target: `ubuntu@app-node`
- `BatchMode=yes`
- `StrictHostKeyChecking=yes`
- known_hosts 사전 등록

key 내용/host key/token을 Jenkinsfile이나 로그에 출력하지 않는다.

## 실패 전파

Shell은 `set -euo pipefail`을 사용한다. 특히 `docker save | ssh docker load`의 앞/뒤 어느 쪽이 실패해도
Stage가 실패한다. `backend/deploy.sh`와 curl/본문 grep 실패도 그대로 Pipeline 실패다.

## 변경 절차

Jenkinsfile 변경 -> Groovy parse -> 각 Bash block `bash -n` -> Gradle test -> Docker build ->
Jenkins 수동 Build Now -> webhook test 순서다. 운영 배포가 포함되므로 실제 Jenkins 검증 시 rollback image를 기록한다.

## 운영 확인

```bash
sudo -u jenkins ./ops/verify/cicd.sh
systemctl status jenkins --no-pager
sudo nginx -t
```

실제 build result와 image tag는 Jenkins build history가 기록 원본이다.

## Frontend job

Script Path는 `frontend/Jenkinsfile`, SCM branch는 `master`다. Backend job의 Script Path는
`backend/Jenkinsfile`이다. Frontend는 Backend job과 다른 webhook exact path를
사용한다. Node host 설치에 의존하지 않고 `node:24.20.0-bookworm-slim`에서 lockfile 기반 `npm ci`를
실행한다. artifact는 Jenkins fingerprint를 남기고 app-node의 `/tmp`로 전송한 뒤
`frontend/deploy.sh`가 `/var/www/ody/releases`에 배치한다.

Frontend routing을 처음 반영할 때 live `/etc/nginx/sites-available/backend`를 먼저 별도 backup하고,
`docs/infra/examples/frontend-nginx.locations.conf`의 static 부분만 기존 TLS server block에 통합한다.
`/api/`, `/actuator/`, upstream, Certbot 부분은 변경하지 않는다. `nginx -t` 실패 시 reload하지 않고 원본을
복원한다.
