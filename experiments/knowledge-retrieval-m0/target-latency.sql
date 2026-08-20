\set ON_ERROR_STOP on

BEGIN;

INSERT INTO ai_call_knowledge_item (
    id, tenant_id, display_name, content_category, created_at, updated_at
) VALUES
    (-91001, 'm0-benchmark', '100切片基准', 'OTHER', now(), now()),
    (-91002, 'm0-benchmark', '500切片基准', 'OTHER', now(), now());

INSERT INTO ai_call_knowledge_version (
    id, tenant_id, knowledge_item_id, version_no, status,
    source_object_key, source_filename, extension, mime_type,
    byte_size, sha256, parser_name, parser_version,
    chunk_strategy_version, chunk_count, chunk_set_sha256,
    created_at, ready_at
) VALUES
    (-91100, 'm0-benchmark', -91001, 1, 'READY', 'bench/100', '100.md', 'md',
     'text/markdown', 10000, repeat('1', 64), 'bench', '1', 'bench', 100,
     repeat('a', 64), now(), now()),
    (-91500, 'm0-benchmark', -91002, 1, 'READY', 'bench/500', '500.md', 'md',
     'text/markdown', 50000, repeat('2', 64), 'bench', '1', 'bench', 500,
     repeat('b', 64), now(), now());

INSERT INTO ai_call_knowledge_chunk (
    id, tenant_id, knowledge_version_id, chunk_index, content,
    content_checksum, content_type, source_type, source_path, created_at
)
SELECT -92000 - value, 'm0-benchmark', -91100, value - 1,
       '企业智能外呼产品资料。退款申请审核通过后五个工作日内原路退回。交付与服务范围以双方确认材料为准。切片'
           || value || repeat(' 业务说明', 20),
       md5(value::text) || md5((value + 1000)::text),
       'TEXT', 'MARKDOWN', 'bench:' || value, now()
FROM generate_series(1, 100) AS value;

INSERT INTO ai_call_knowledge_chunk (
    id, tenant_id, knowledge_version_id, chunk_index, content,
    content_checksum, content_type, source_type, source_path, created_at
)
SELECT -93000 - value, 'm0-benchmark', -91500, value - 1,
       '企业智能外呼产品资料。退款申请审核通过后五个工作日内原路退回。交付与服务范围以双方确认材料为准。切片'
           || value || repeat(' 业务说明', 20),
       md5(value::text) || md5((value + 2000)::text),
       'TEXT', 'MARKDOWN', 'bench:' || value, now()
FROM generate_series(1, 500) AS value;

CREATE TEMPORARY TABLE benchmark_latency (
    scope integer,
    run_no integer,
    elapsed_ms double precision
) ON COMMIT DROP;

DO $benchmark$
DECLARE
    scope_size integer;
    version_ids bigint[];
    run_no integer;
    started_at timestamptz;
BEGIN
    FOREACH scope_size IN ARRAY ARRAY[100, 500]
    LOOP
        version_ids := CASE
            WHEN scope_size = 100 THEN ARRAY[-91100::bigint]
            ELSE ARRAY[-91500::bigint]
        END;
        FOR run_no IN 1..105
        LOOP
            started_at := clock_timestamp();
            PERFORM chunk.id
            FROM ai_call_knowledge_chunk AS chunk
            JOIN ai_call_knowledge_version AS version
              ON version.id = chunk.knowledge_version_id
             AND version.tenant_id = chunk.tenant_id
            CROSS JOIN LATERAL (
                SELECT ai_call_knowledge_ngram_tsquery(
                    '退款审核后多久原路退回'
                ) AS query_value
            ) AS query_features
            WHERE chunk.tenant_id = 'm0-benchmark'
              AND chunk.knowledge_version_id = ANY(version_ids)
              AND version.status = 'READY'
              AND chunk.ngram_tsv @@ query_features.query_value
            ORDER BY ts_rank_cd(
                ARRAY[0.05, 0.20, 0.50, 1.00]::real[],
                chunk.ngram_tsv,
                query_features.query_value,
                32
            ) DESC,
            chunk.knowledge_version_id,
            chunk.chunk_index,
            chunk.id
            LIMIT 5;

            IF run_no > 5 THEN
                INSERT INTO benchmark_latency VALUES (
                    scope_size,
                    run_no - 5,
                    extract(epoch FROM clock_timestamp() - started_at) * 1000
                );
            END IF;
        END LOOP;
    END LOOP;
END
$benchmark$;

SELECT scope AS chunks,
       count(*) AS runs,
       round(avg(elapsed_ms)::numeric, 3) AS avg_ms,
       round(percentile_disc(0.50) WITHIN GROUP (
           ORDER BY elapsed_ms
       )::numeric, 3) AS p50_ms,
       round(percentile_disc(0.95) WITHIN GROUP (
           ORDER BY elapsed_ms
       )::numeric, 3) AS p95_ms,
       round(max(elapsed_ms)::numeric, 3) AS max_ms
FROM benchmark_latency
GROUP BY scope
ORDER BY scope;

ROLLBACK;
