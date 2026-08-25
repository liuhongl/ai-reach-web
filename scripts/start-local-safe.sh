#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
frontend_dir="$(cd "$script_dir/.." && pwd -P)"
ai_call_repo="${AI_CALL_REPO_DIR:-$HOME/Desktop/lingchen/ai-call}"
frontend_port=8079
backend_port=19011
mode="${1:-start}"

if (($# > 1)) || [[ "$mode" != "start" && "$mode" != "--check" ]]; then
    echo "Usage: $0 [--check]" >&2
    exit 2
fi

for command in curl git lsof node; do
    command -v "$command" >/dev/null || {
        echo "Missing required command: $command" >&2
        exit 1
    }
done

find_worktree_by_branch() {
    local branch="$1" candidate
    while IFS= read -r candidate; do
        [[ -d "$candidate" ]] || continue
        if [[ "$(git -C "$candidate" branch --show-current)" == "$branch" ]]; then
            printf '%s' "$candidate"
            return 0
        fi
    done < <(git -C "$ai_call_repo" worktree list --porcelain | sed -n 's/^worktree //p')
    return 1
}

backend_dir="${AI_CALL_BACKEND_DIR:-}"
if [[ -z "$backend_dir" ]]; then
    if [[ -f "$ai_call_repo/app/api/v1/ai_call/knowledge_controller.py" ]] &&
        [[ -x "$ai_call_repo/tools/start_ai_call_19011.sh" ]]; then
        backend_dir="$ai_call_repo"
    else
        backend_dir="$(find_worktree_by_branch codex/knowledge-base-integrated || true)"
    fi
fi
[[ -x "$backend_dir/tools/start_ai_call_19011.sh" ]] || {
    echo "Knowledge-enabled AI Call backend not found; set AI_CALL_BACKEND_DIR" >&2
    exit 1
}

# ponytail: local fallback until the integrated backend owns its env files; explicit overrides take precedence.
runtime_env_file="${AI_CALL_RUNTIME_ENV_FILE:-}"
if [[ -z "$runtime_env_file" ]]; then
    if [[ -f "$backend_dir/env/.env.dev" ]]; then
        runtime_env_file="$backend_dir/env/.env.dev"
    else
        runtime_worktree="$(find_worktree_by_branch codex/ai-call-workflow-split || true)"
        runtime_env_file="$runtime_worktree/env/.env.dev"
    fi
fi
[[ -f "$runtime_env_file" ]] || {
    echo "AI Call runtime environment not found; set AI_CALL_RUNTIME_ENV_FILE" >&2
    exit 1
}

knowledge_env_file="${AI_CALL_KNOWLEDGE_ENV_FILE:-}"
if [[ -z "$knowledge_env_file" ]]; then
    local_knowledge_env="$HOME/Desktop/lingchen/project/lingchen-leads/部署说明/部署说明/leads-ai.production.env"
    [[ -f "$local_knowledge_env" ]] && knowledge_env_file="$local_knowledge_env"
fi

frontend_env_file="${AI_REACH_ENV_FILE:-$frontend_dir/.env.local}"
if [[ ! -f "$frontend_env_file" ]]; then
    main_frontend_dir="$(git -C "$frontend_dir" worktree list --porcelain | awk '
        /^worktree / { path = substr($0, 10) }
        /^branch refs\/heads\/main$/ { print path; exit }
    ')"
    [[ -f "$main_frontend_dir/.env.local" ]] && frontend_env_file="$main_frontend_dir/.env.local"
fi

backend_launcher="$backend_dir/tools/start_ai_call_19011.sh"
backend_environment=(AI_CALL_RUNTIME_ENV_FILE="$runtime_env_file")
[[ -n "$knowledge_env_file" ]] && backend_environment+=(AI_CALL_KNOWLEDGE_ENV_FILE="$knowledge_env_file")

require_routes() {
    local url="$1" openapi
    openapi="$(curl -fsS --max-time 10 "$url")"
    grep -Fq '"/ai-call/knowledge/items"' <<<"$openapi" || {
        echo "Knowledge route is missing from $url" >&2
        return 1
    }
    grep -Fq '"/ai-call/prompt-profiles"' <<<"$openapi" || {
        echo "Prompt route is missing from $url" >&2
        return 1
    }
}

check_frontend() {
    local listener_pid listener_cwd
    listener_pid="$(lsof -nP -tiTCP:"$frontend_port" -sTCP:LISTEN | head -1 || true)"
    [[ -n "$listener_pid" ]] || {
        echo "Frontend port $frontend_port is not listening" >&2
        return 1
    }
    listener_cwd="$(lsof -a -p "$listener_pid" -d cwd -Fn | sed -n 's/^n//p')"
    [[ "$listener_cwd" == "$frontend_dir" ]] || {
        echo "Port $frontend_port belongs to another checkout: pid=$listener_pid cwd=$listener_cwd" >&2
        return 1
    }
    curl -fsS --max-time 10 "http://127.0.0.1:$frontend_port/user/login" >/dev/null
    curl -fsS --max-time 10 "http://127.0.0.1:$frontend_port/dev-api/auth/tenant/list" >/dev/null
    curl -fsS --max-time 20 "http://127.0.0.1:$frontend_port/dev-api/auth/code" >/dev/null
    require_routes "http://127.0.0.1:$frontend_port/ai-call-agent-api/openapi.json"
}

if [[ "$mode" == "--check" ]]; then
    env "${backend_environment[@]}" "$backend_launcher" --safe --check
    check_frontend
    echo "Local safe stack ok: frontend=$frontend_dir backend=$backend_dir"
    exit 0
fi

for port in "$frontend_port" "$backend_port"; do
    listener_pid="$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN | head -1 || true)"
    if [[ -n "$listener_pid" ]]; then
        listener_cwd="$(lsof -a -p "$listener_pid" -d cwd -Fn | sed -n 's/^n//p')"
        echo "Port $port is already listening: pid=$listener_pid cwd=$listener_cwd" >&2
        exit 1
    fi
done

env "${backend_environment[@]}" "$backend_launcher" --safe --check

run_dir="${TMPDIR:-/tmp}/ai-reach-local-safe"
mkdir -p "$run_dir"
backend_log="$run_dir/backend.log"
frontend_log="$run_dir/frontend.log"
backend_pid=''
frontend_pid=''

cleanup() {
    local status=$?
    trap - EXIT INT TERM
    for pid in "$frontend_pid" "$backend_pid"; do
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            wait "$pid" 2>/dev/null || true
        fi
    done
    exit "$status"
}
trap cleanup EXIT INT TERM

env "${backend_environment[@]}" "$backend_launcher" --safe >"$backend_log" 2>&1 &
backend_pid=$!

backend_ready=false
for _ in {1..90}; do
    if curl -fsS --max-time 5 "http://127.0.0.1:$backend_port/ai-call/health" >/dev/null 2>&1; then
        backend_ready=true
        break
    fi
    kill -0 "$backend_pid" 2>/dev/null || break
    sleep 1
done
if [[ "$backend_ready" != true ]]; then
    echo "Safe backend failed to start; log: $backend_log" >&2
    exit 1
fi
require_routes "http://127.0.0.1:$backend_port/openapi.json"

node_command=(node)
[[ -f "$frontend_env_file" ]] && node_command+=(--env-file="$frontend_env_file")
node_command+=("$frontend_dir/node_modules/@umijs/max/bin/max.js" dev)
(
    cd "$frontend_dir"
    env \
        PORT="$frontend_port" \
        UMI_ENV=dev \
        MOCK=none \
        AI_REACH_E2E=1 \
        UMI_APP_AI_CALL_API_TARGET="http://127.0.0.1:$backend_port" \
        "${node_command[@]}"
) >"$frontend_log" 2>&1 &
frontend_pid=$!

frontend_ready=false
for _ in {1..120}; do
    if curl -fsS --max-time 5 "http://127.0.0.1:$frontend_port/user/login" >/dev/null 2>&1; then
        frontend_ready=true
        break
    fi
    kill -0 "$frontend_pid" 2>/dev/null || break
    sleep 1
done
if [[ "$frontend_ready" != true ]]; then
    echo "Frontend failed to start; log: $frontend_log" >&2
    exit 1
fi

frontend_compiled=false
for _ in {1..120}; do
    if grep -q '\[Webpack\] Compiled' "$frontend_log"; then
        frontend_compiled=true
        break
    fi
    kill -0 "$frontend_pid" 2>/dev/null || break
    sleep 1
done
if [[ "$frontend_compiled" != true ]]; then
    echo "Frontend compilation timed out; log: $frontend_log" >&2
    exit 1
fi
check_frontend

echo "Local safe stack started: http://127.0.0.1:$frontend_port"
echo "Logs: $run_dir"
while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do
    sleep 2
done
echo "A local service exited; logs: $run_dir" >&2
exit 1
