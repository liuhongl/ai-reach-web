#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
query_file="$script_dir/target-concurrency-query.sql"
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/ai-call-kb-benchmark.XXXXXX")

: "${PGUSER:=${POSTGRES_USER:-postgres}}"
: "${PGDATABASE:=${POSTGRES_DB:-postgres}}"
export PGUSER PGDATABASE

cleanup() {
    psql -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DELETE FROM ai_call_knowledge_chunk
WHERE tenant_id = 'm0-bench-concurrent';
DELETE FROM ai_call_knowledge_version
WHERE tenant_id = 'm0-bench-concurrent';
DELETE FROM ai_call_knowledge_item
WHERE tenant_id = 'm0-bench-concurrent';
SQL
    rm -rf -- "$tmp_dir"
}
trap cleanup EXIT INT TERM

psql -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
BEGIN;

DELETE FROM ai_call_knowledge_chunk
WHERE tenant_id = 'm0-bench-concurrent';
DELETE FROM ai_call_knowledge_version
WHERE tenant_id = 'm0-bench-concurrent';
DELETE FROM ai_call_knowledge_item
WHERE tenant_id = 'm0-bench-concurrent';

INSERT INTO ai_call_knowledge_item (
    id, tenant_id, display_name, content_category, created_at, updated_at
) VALUES (
    -91010, 'm0-bench-concurrent', '500切片并发基准', 'OTHER', now(), now()
);

INSERT INTO ai_call_knowledge_version (
    id, tenant_id, knowledge_item_id, version_no, status,
    source_object_key, source_filename, extension, mime_type,
    byte_size, sha256, parser_name, parser_version,
    chunk_strategy_version, chunk_count, chunk_set_sha256,
    created_at, ready_at
) VALUES (
    -91510, 'm0-bench-concurrent', -91010, 1, 'READY',
    'bench/concurrency-500', 'concurrency-500.md', 'md', 'text/markdown',
    50000, repeat('3', 64), 'bench', '1', 'bench', 500,
    repeat('c', 64), now(), now()
);

INSERT INTO ai_call_knowledge_chunk (
    id, tenant_id, knowledge_version_id, chunk_index, content,
    content_checksum, content_type, source_type, source_path, created_at
)
SELECT -94000 - value, 'm0-bench-concurrent', -91510, value - 1,
       '企业智能外呼产品资料。退款申请审核通过后五个工作日内原路退回。交付与服务范围以双方确认材料为准。切片'
           || value || repeat(' 业务说明', 20),
       md5(value::text) || md5((value + 3000)::text),
       'TEXT', 'MARKDOWN', 'bench-concurrency:' || value, now()
FROM generate_series(1, 500) AS value;

COMMIT;
SQL

measure() {
    label=$1
    concurrency=$2
    transactions_per_client=$3
    summary_file="$tmp_dir/summary-$label-$concurrency.txt"
    values_file="$tmp_dir/values-$label-$concurrency.txt"

    rm -f "$tmp_dir"/pgbench_log.*
    (
        cd "$tmp_dir"
        pgbench -n -M prepared \
            -c "$concurrency" -j "$concurrency" \
            -t "$transactions_per_client" -l \
            -f "$query_file" >"$summary_file"
    )

    awk '{ printf "%.6f\n", $3 / 1000 }' "$tmp_dir"/pgbench_log.* \
        | sort -n >"$values_file"
    samples=$(wc -l <"$values_file" | tr -d ' ')
    p50_index=$(( (samples * 50 + 99) / 100 ))
    p95_index=$(( (samples * 95 + 99) / 100 ))
    avg=$(awk '{ total += $1 } END { printf "%.3f", total / NR }' "$values_file")
    p50=$(sed -n "${p50_index}p" "$values_file")
    p95=$(sed -n "${p95_index}p" "$values_file")
    max=$(tail -n 1 "$values_file")
    tps=$(awk '/^tps = / { value = $3 } END { printf "%.3f", value }' "$summary_file")

    printf '%s\t%s\t%s\t%s\t%.3f\t%.3f\t%.3f\t%s\n' \
        "$label" "$concurrency" "$samples" "$avg" "$p50" "$p95" "$max" "$tps"
}

printf 'mode\tconcurrency\tsamples\tavg_ms\tp50_ms\tp95_ms\tmax_ms\ttps\n'

# 首次查询仅表示未显式预热；插入本身可能已将数据页放入共享缓存。
measure first_after_setup 1 1

for concurrency in 1 5 10; do
    pgbench -n -M prepared \
        -c "$concurrency" -j "$concurrency" -t 5 \
        -f "$query_file" >/dev/null
    transactions_per_client=$(( 100 / concurrency ))
    measure warm "$concurrency" "$transactions_per_client"
done

remaining=$(psql -X -Atqc "
    SELECT count(*)
    FROM ai_call_knowledge_chunk
    WHERE tenant_id = 'm0-bench-concurrent'
")
test "$remaining" -eq 500
