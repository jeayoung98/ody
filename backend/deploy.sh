#!/bin/bash

set -e

IMAGE_NAME=${1:-backend:1.0}

# Fail before changing a slot when an image has not been transferred yet.
docker image inspect "$IMAGE_NAME" >/dev/null
exec 9>/home/ubuntu/.ody-backend-deploy.lock
flock -n 9 || { echo 'ERROR: Another Blue-Green deployment is running'; exit 1; }

# Optional DB rollout: a root-managed env file opts both slots into the same network.
DOCKER_RUNTIME_ARGS=()
if [ -e /etc/ody/backend.env ]; then
    test -r /etc/ody/backend.env || { echo 'ERROR: backend.env is not readable'; exit 1; }
    docker network inspect ody-internal >/dev/null
    DOCKER_RUNTIME_ARGS=(--network ody-internal --env-file /etc/ody/backend.env)
fi

NGINX_CONFIG="/etc/nginx/sites-available/backend"

BLUE_PORT=8081
GREEN_PORT=8082

BLUE_CONTAINER="backend-blue"
GREEN_CONTAINER="backend-green"

echo "======================================"
echo " Blue-Green Deployment"
echo " Image: $IMAGE_NAME"
echo "======================================"

# --------------------------------------------------
# 1. 현재 활성 포트 확인
# --------------------------------------------------

CURRENT_PORT=$(grep -oP 'server 127\.0\.0\.1:\K[0-9]+' "$NGINX_CONFIG" | head -1)

echo "Current active port: $CURRENT_PORT"

if [ "$CURRENT_PORT" = "$BLUE_PORT" ]; then

    CURRENT_CONTAINER=$BLUE_CONTAINER

    TARGET_PORT=$GREEN_PORT
    TARGET_CONTAINER=$GREEN_CONTAINER

elif [ "$CURRENT_PORT" = "$GREEN_PORT" ]; then

    CURRENT_CONTAINER=$GREEN_CONTAINER

    TARGET_PORT=$BLUE_PORT
    TARGET_CONTAINER=$BLUE_CONTAINER

else

    echo "ERROR: Cannot determine current active port."
    exit 1
fi

echo "Current container : $CURRENT_CONTAINER"
echo "Target container  : $TARGET_CONTAINER"
echo "Target port       : $TARGET_PORT"

# --------------------------------------------------
# 2. 이전 Target Container가 남아있으면 제거
# --------------------------------------------------

if docker ps -a --format '{{.Names}}' | grep -q "^${TARGET_CONTAINER}$"; then

    echo "Removing old $TARGET_CONTAINER..."

    docker rm -f "$TARGET_CONTAINER"
fi

# --------------------------------------------------
# 3. 새로운 Container 실행
# --------------------------------------------------

echo "Starting new container..."

docker run -d \
    "${DOCKER_RUNTIME_ARGS[@]}" \
    --name "$TARGET_CONTAINER" \
    --restart unless-stopped \
    -p "127.0.0.1:${TARGET_PORT}:8080" \
    --env-file "$ENV_FILE" \
    --network ody-internal \
    "$IMAGE_NAME"

# --------------------------------------------------
# 4. Health Check
# --------------------------------------------------

echo "Waiting for application health..."

MAX_RETRIES=30
RETRY_INTERVAL=2

for ((i=1; i<=MAX_RETRIES; i++)); do

    RESPONSE=$(curl -s \
        "http://127.0.0.1:${TARGET_PORT}/actuator/health" || true)

    if echo "$RESPONSE" | grep -q '"status":"UP"'; then

        echo "Health check passed."
        break
    fi

    echo "Health check $i/$MAX_RETRIES..."

    sleep $RETRY_INTERVAL

    if [ "$i" -eq "$MAX_RETRIES" ]; then

        echo "ERROR: Health check failed."

        echo "---- Container Logs ----"

        docker logs "$TARGET_CONTAINER" || true

        echo "Removing failed container..."

        docker rm -f "$TARGET_CONTAINER"

        exit 1
    fi

done

# --------------------------------------------------
# 5. Nginx upstream 변경
# --------------------------------------------------

echo "Switching Nginx..."

sudo sed -i \
    "s/server 127.0.0.1:${CURRENT_PORT};/server 127.0.0.1:${TARGET_PORT};/" \
    "$NGINX_CONFIG"

# --------------------------------------------------
# 6. Nginx 설정 검증
# --------------------------------------------------

if ! sudo nginx -t; then

    echo "ERROR: nginx configuration test failed."

    echo "Rolling back nginx configuration..."

    sudo sed -i \
        "s/server 127.0.0.1:${TARGET_PORT};/server 127.0.0.1:${CURRENT_PORT};/" \
        "$NGINX_CONFIG"

    docker rm -f "$TARGET_CONTAINER"

    exit 1
fi

# --------------------------------------------------
# 7. Nginx Reload
# --------------------------------------------------

if ! sudo systemctl reload nginx; then
    sudo sed -i "s/server 127.0.0.1:${TARGET_PORT};/server 127.0.0.1:${CURRENT_PORT};/" "$NGINX_CONFIG"
    sudo nginx -t && sudo systemctl reload nginx
    echo 'ERROR: Reload failed; previous upstream restored and both containers retained.'
    exit 1
fi

echo "Nginx switched to port $TARGET_PORT."

# --------------------------------------------------
# 8. Nginx를 통한 최종 Health Check
# --------------------------------------------------

sleep 2

FINAL_RESPONSE=$(curl -s \
    http://127.0.0.1/actuator/health || true)

if ! echo "$FINAL_RESPONSE" | grep -q '"status":"UP"'; then

    echo "ERROR: Final health check failed."

    echo "Rolling back to port $CURRENT_PORT..."

    sudo sed -i \
        "s/server 127.0.0.1:${TARGET_PORT};/server 127.0.0.1:${CURRENT_PORT};/" \
        "$NGINX_CONFIG"

    sudo nginx -t
    sudo systemctl reload nginx

    docker rm -f "$TARGET_CONTAINER"

    exit 1
fi

# --------------------------------------------------
# 9. 기존 Container 제거
# --------------------------------------------------

if docker ps -a --format '{{.Names}}' | grep -q "^${CURRENT_CONTAINER}$"; then

    echo "Stopping old container: $CURRENT_CONTAINER"

    docker rm -f "$CURRENT_CONTAINER"
fi

echo ""
echo "======================================"
echo " Deployment Successful"
echo " Active container : $TARGET_CONTAINER"
echo " Active port      : $TARGET_PORT"
echo "======================================"
