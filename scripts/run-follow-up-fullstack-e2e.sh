#!/usr/bin/env bash
set -euo pipefail

FRONTEND_DIR=$(cd "$(dirname "$0")/.." && pwd)
BACKEND_DIR=${AI_CALL_E2E_BACKEND_DIR:-}
FRONTEND_PORT=8079
BACKEND_PORT=19013

if [[ -z "$BACKEND_DIR" ]] && [[ -d "$FRONTEND_DIR/../ai-call/.git" ]]; then
  while IFS= read -r candidate; do
    if grep -q 'async def schedule_follow_up_data_controller' \
      "$candidate/app/api/v1/ai_call/follow_up_data_controller.py" 2>/dev/null; then
      BACKEND_DIR=$candidate
      break
    fi
  done < <(
    git -C "$FRONTEND_DIR/../ai-call" worktree list --porcelain |
      sed -n 's/^worktree //p'
  )
fi
if [[ ! -f "$BACKEND_DIR/pyproject.toml" ]]; then
  echo "未找到包含跟进数据接口的 AI Call 后端，请设置 AI_CALL_E2E_BACKEND_DIR" >&2
  exit 1
fi
if [[ ! -x "$BACKEND_DIR/.venv/bin/python" ]]; then
  echo "AI Call 后端虚拟环境不存在：$BACKEND_DIR/.venv/bin/python" >&2
  exit 1
fi
for port in "$FRONTEND_PORT" "$BACKEND_PORT"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "测试端口 $port 已被占用" >&2
    exit 1
  fi
done

E2E_TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/ai-reach-follow-up-e2e.XXXXXX")
FRONTEND_RUN_DIR="$E2E_TEMP_DIR/frontend"
BACKEND_LOG="$E2E_TEMP_DIR/backend.log"
FRONTEND_LOG="$E2E_TEMP_DIR/frontend.log"
BACKEND_PID=''
FRONTEND_PID=''

cleanup() {
  local status=$?
  trap - EXIT
  for pid in "$FRONTEND_PID" "$BACKEND_PID"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  if [[ $status -ne 0 ]]; then
    tail -n 80 "$BACKEND_LOG" >&2 || true
    tail -n 80 "$FRONTEND_LOG" >&2 || true
  fi
  case "$E2E_TEMP_DIR" in
    */ai-reach-follow-up-e2e.*) rm -rf -- "$E2E_TEMP_DIR" ;;
  esac
  exit "$status"
}
trap cleanup EXIT

rsync -a \
  --exclude '.env*' \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'output/' \
  --exclude 'src/.umi/' \
  "$FRONTEND_DIR/" "$FRONTEND_RUN_DIR/"
ln -s "$FRONTEND_DIR/node_modules" "$FRONTEND_RUN_DIR/node_modules"

(
  cd "$BACKEND_DIR"
  env \
    ENVIRONMENT=local \
    DATABASE_TYPE=sqlite \
    DATABASE_NAME="$E2E_TEMP_DIR/follow-up-data" \
    JWT_ENABLE=false \
    REDIS_ENABLE=false \
    AI_CALL_STANDALONE_ENABLE=true \
    AI_CALL_PROCESS_ROLES=api \
    AI_CALL_SIP_OUTBOUND_ENABLED=false \
    AI_CALL_RUNTIME_PROVIDER_MODE=stub \
    AI_CALL_RUNTIME_REAL_PROVIDER_ALLOWED=false \
    AI_CALL_E2E_PORT="$BACKEND_PORT" \
    PYTHONPATH="$BACKEND_DIR" \
    "$BACKEND_DIR/.venv/bin/python" \
    "$FRONTEND_DIR/e2e/support/follow_up_backend.py"
) >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

BACKEND_READY=false
for _ in {1..90}; do
  if curl --silent --fail \
    "http://127.0.0.1:$BACKEND_PORT/ai-call/follow-up-data?classification=interested&pageNum=1&pageSize=20" \
    >/dev/null; then
    BACKEND_READY=true
    break
  fi
  sleep 1
done
if [[ "$BACKEND_READY" != true ]] || ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "隔离后端启动失败" >&2
  exit 1
fi

(
  cd "$FRONTEND_RUN_DIR"
  env \
    PORT="$FRONTEND_PORT" \
    AI_REACH_E2E=1 \
    UMI_ENV=dev \
    MOCK=none \
    UMI_APP_AI_CALL_API_TARGET="http://127.0.0.1:$BACKEND_PORT" \
    ./node_modules/.bin/max dev
) >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

FRONTEND_READY=false
for _ in {1..120}; do
  if curl --silent --fail "http://127.0.0.1:$FRONTEND_PORT/user/login" >/dev/null; then
    FRONTEND_READY=true
    break
  fi
  sleep 1
done
if [[ "$FRONTEND_READY" != true ]] || ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
  echo "隔离前端启动失败" >&2
  exit 1
fi

FRONTEND_COMPILED=false
for _ in {1..120}; do
  if grep -q '\[Webpack\] Compiled' "$FRONTEND_LOG"; then
    FRONTEND_COMPILED=true
    break
  fi
  sleep 1
done
if [[ "$FRONTEND_COMPILED" != true ]]; then
  echo "隔离前端编译超时" >&2
  exit 1
fi

cd "$FRONTEND_DIR"
PLAYWRIGHT_EXTERNAL_SERVER=1 \
PLAYWRIGHT_BASE_URL="http://127.0.0.1:$FRONTEND_PORT" \
./node_modules/.bin/playwright test e2e/follow-up.fullstack.spec.ts
