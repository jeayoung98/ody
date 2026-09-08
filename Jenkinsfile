pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
    }

    environment {
        JAVA_HOME = '/usr/lib/jvm/java-17-openjdk-amd64'
        IMAGE_NAME = 'backend'
        SSH_KEY = '/var/lib/jenkins/.ssh/app_deploy'
        DEPLOY_USER = 'ubuntu'
        DEPLOY_HOST = 'app-node'
        APP_DIR = '/home/ubuntu/S15P21A405'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Test') {
            steps {
                dir('backend') {
                    sh '''#!/usr/bin/env bash
set -euo pipefail
export PATH="${JAVA_HOME}/bin:${PATH}"

java -version
java -version 2>&1 | grep -Eq 'version "17([.]|")'
chmod +x gradlew
./gradlew clean test --no-daemon
'''
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                dir('backend') {
                    sh '''#!/usr/bin/env bash
set -euo pipefail

docker build -t "${IMAGE_NAME}:${BUILD_NUMBER}" .
'''
                }
            }
        }

        stage('Transfer Image') {
            steps {
                sh '''#!/usr/bin/env bash
set -euo pipefail

docker save "${IMAGE_NAME}:${BUILD_NUMBER}" | \
    ssh \
        -i "${SSH_KEY}" \
        -o BatchMode=yes \
        -o StrictHostKeyChecking=yes \
        "${DEPLOY_USER}@${DEPLOY_HOST}" \
        docker load
'''
            }
        }

        stage('Deploy') {
            steps {
                sh '''#!/usr/bin/env bash
set -euo pipefail

ssh \
    -i "${SSH_KEY}" \
    -o BatchMode=yes \
    -o StrictHostKeyChecking=yes \
    "${DEPLOY_USER}@${DEPLOY_HOST}" \
    "cd '${APP_DIR}' && test -x ./deploy.sh && ./deploy.sh '${IMAGE_NAME}:${BUILD_NUMBER}'"
'''
            }
        }

        stage('Verify') {
            steps {
                sh '''#!/usr/bin/env bash
set -euo pipefail

health_response="$(
    ssh \
        -i "${SSH_KEY}" \
        -o BatchMode=yes \
        -o StrictHostKeyChecking=yes \
        "${DEPLOY_USER}@${DEPLOY_HOST}" \
        curl -fsS http://localhost/actuator/health
)"

printf '%s\n' "${health_response}"
printf '%s' "${health_response}" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"UP"'
'''
            }
        }
    }

    post {
        always {
            sh '''#!/usr/bin/env bash
docker image rm "${IMAGE_NAME}:${BUILD_NUMBER}" || true
'''
        }
        success {
            echo "Deployment succeeded: ${IMAGE_NAME}:${BUILD_NUMBER}"
        }
        failure {
            echo "Pipeline failed. Check the failed stage logs."
        }
    }
}
