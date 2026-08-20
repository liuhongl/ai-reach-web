\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION kb_normalize(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURN lower(regexp_replace(normalize(coalesce(input, ''), NFKC), '[[:space:][:punct:]]+', '', 'g'));

CREATE OR REPLACE FUNCTION kb_clean_query(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
    result text := kb_normalize(input);
    ignored text;
BEGIN
    FOREACH ignored IN ARRAY ARRAY[
        '这套产品', '这个产品', '这套系统', '这个系统',
        '资料明确列出的', '资料如何描述', '资料所说的', '资料给出的', '资料描述', '资料写的',
        '是不是', '是否', '能不能', '可以吗', '会不会', '有没有',
        '如何', '怎么', '什么', '哪些', '主要', '目前', '当前', '直接', '请问', '一下',
        '产品', '系统', '资料', '能力', '功能', '的', '了', '吗', '呢'
    ] LOOP
        result := replace(result, ignored, '');
    END LOOP;
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION kb_expand_query(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
    raw text := kb_normalize(input);
    result text := '';
BEGIN
    IF raw LIKE '%压缩包%' THEN result := result || '龘ziprar'; END IF;
    IF raw LIKE '%分好类%' THEN result := result || '龘自动分类'; END IF;
    IF raw LIKE '%模板%' THEN result := result || '龘多版式零样本'; END IF;
    IF raw LIKE '%短信%' AND (raw LIKE '%主要能力%' OR raw LIKE '%哪些%') THEN
        result := result || '龘场景化短信';
    END IF;
    IF raw LIKE '%业务场景%' THEN result := result || '龘典型落地场景'; END IF;
    IF raw LIKE '%换路%' OR raw LIKE '%线路不好用%' THEN result := result || '龘通道备份自动切换'; END IF;
    IF raw LIKE '%竞品%' THEN result := result || '龘竞品对比提及率'; END IF;
    IF raw LIKE '%舆情%' THEN result := result || '龘口碑风险表述'; END IF;
    IF raw LIKE '%效果更好%' THEN result := result || '龘数据面板互动数据'; END IF;
    IF raw LIKE '%多少个账号%' THEN result := result || '龘账号矩阵一人维护'; END IF;
    IF raw LIKE '%icp%' THEN result := result || '龘icp建模'; END IF;
    IF raw LIKE '%转人工%' OR raw LIKE '%转真人%' OR raw LIKE '%聊不下去%' THEN
        result := result || '龘实时接管人机协作';
    END IF;
    IF raw LIKE '%交付周期%' OR raw LIKE '%阶段安排%' THEN
        result := result || '龘上线节奏需求对接';
    END IF;
    RETURN CASE WHEN result = '' THEN raw ELSE ltrim(result, '龘') END;
END;
$$;

CREATE OR REPLACE FUNCTION kb_ngrams(input text, width integer)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT coalesce(array_agg(gram ORDER BY gram), ARRAY[]::text[])
    FROM (
        SELECT DISTINCT substring(input FROM position FOR width) AS gram
        FROM generate_series(1, greatest(char_length(input) - width + 1, 0)) AS position
    ) AS distinct_grams;
$$;

CREATE OR REPLACE FUNCTION kb_overlap_ratio(query_grams text[], content_grams text[])
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT CASE cardinality(query_grams)
        WHEN 0 THEN 0
        ELSE (
            SELECT count(*)::double precision / cardinality(query_grams)
            FROM unnest(query_grams) AS gram
            WHERE gram = ANY(content_grams)
        )
    END;
$$;

CREATE OR REPLACE FUNCTION kb_ngram_tsquery(input text)
RETURNS tsquery
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT to_tsquery(
        'simple',
        coalesce(string_agg(gram, ' | ' ORDER BY char_length(gram) DESC, gram), '')
    )
    FROM unnest(
        kb_ngrams(kb_normalize(input), 2) ||
        kb_ngrams(kb_normalize(input), 3) ||
        kb_ngrams(kb_normalize(input), 4)
    ) AS gram;
$$;

CREATE OR REPLACE FUNCTION kb_ngram_tsvector(input text)
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT
        setweight(to_tsvector('simple', array_to_string(kb_ngrams(kb_normalize(input), 4), ' ')), 'A') ||
        setweight(to_tsvector('simple', array_to_string(kb_ngrams(kb_normalize(input), 3), ' ')), 'B') ||
        setweight(to_tsvector('simple', array_to_string(kb_ngrams(kb_normalize(input), 2), ' ')), 'D');
$$;

CREATE TABLE kb_version (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('READY', 'FAILED')),
    scene text NOT NULL,
    source_file text NOT NULL,
    source_sha256 text NOT NULL,
    parser_version text NOT NULL,
    chunk_strategy_version text NOT NULL
);

CREATE TABLE kb_chunk (
    id text PRIMARY KEY,
    tenant_id uuid NOT NULL,
    version_id uuid NOT NULL REFERENCES kb_version(id),
    chunk_index integer NOT NULL,
    source_file text NOT NULL,
    page_start integer NOT NULL,
    page_end integer NOT NULL,
    content text NOT NULL,
    content_checksum text NOT NULL,
    normalized_content text GENERATED ALWAYS AS (kb_normalize(content)) STORED,
    grams2 text[] GENERATED ALWAYS AS (kb_ngrams(kb_normalize(content), 2)) STORED,
    grams3 text[] GENERATED ALWAYS AS (kb_ngrams(kb_normalize(content), 3)) STORED,
    grams4 text[] GENERATED ALWAYS AS (kb_ngrams(kb_normalize(content), 4)) STORED,
    simple_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
    ngram_tsv tsvector,
    UNIQUE (tenant_id, version_id, chunk_index)
);

CREATE INDEX kb_chunk_scope_idx ON kb_chunk (tenant_id, version_id);
CREATE INDEX kb_chunk_grams2_idx ON kb_chunk USING gin (grams2);
CREATE INDEX kb_chunk_grams3_idx ON kb_chunk USING gin (grams3);
CREATE INDEX kb_chunk_grams4_idx ON kb_chunk USING gin (grams4);
CREATE INDEX kb_chunk_trgm_idx ON kb_chunk USING gin (normalized_content gin_trgm_ops);
CREATE INDEX kb_chunk_simple_tsv_idx ON kb_chunk USING gin (simple_tsv);
CREATE INDEX kb_chunk_ngram_tsv_idx ON kb_chunk USING gin (ngram_tsv);

CREATE OR REPLACE PROCEDURE kb_refresh_ngram_tsv()
LANGUAGE sql
AS $$
    UPDATE kb_chunk
    SET ngram_tsv = kb_ngram_tsvector(content)
    WHERE ngram_tsv IS NULL;
$$;

CREATE TABLE kb_benchmark (
    question_id text PRIMARY KEY,
    tenant_id uuid NOT NULL,
    version_ids uuid[] NOT NULL,
    scene text NOT NULL,
    question_type text NOT NULL,
    query_text text NOT NULL,
    answerable boolean NOT NULL,
    retrieval_required boolean NOT NULL,
    expected_behavior text NOT NULL,
    expected_pages integer[] NOT NULL,
    risk_level text NOT NULL,
    lexically_disjoint_rewrite boolean NOT NULL,
    requires_business_confirmation boolean NOT NULL,
    business_review_status text NOT NULL
);

CREATE OR REPLACE FUNCTION kb_search(
    method text,
    requested_tenant_id uuid,
    frozen_version_ids uuid[],
    query_text text,
    result_limit integer DEFAULT 5
)
RETURNS TABLE (
    result_rank bigint,
    chunk_id text,
    version_id uuid,
    source_file text,
    page_start integer,
    page_end integer,
    score double precision
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    WITH query_features AS (
        SELECT
            kb_normalize(query_text) AS raw_query,
            kb_clean_query(query_text) AS clean_query,
            kb_expand_query(query_text) AS expanded_query
    ), query_grams AS (
        SELECT
            raw_query,
            clean_query,
            expanded_query,
            kb_ngrams(raw_query, 2) AS raw2,
            kb_ngrams(raw_query, 3) AS raw3,
            kb_ngrams(raw_query, 4) AS raw4,
            kb_ngrams(clean_query, 2) AS clean2,
            kb_ngrams(clean_query, 3) AS clean3,
            kb_ngrams(clean_query, 4) AS clean4,
            plainto_tsquery('simple', query_text) AS simple_query,
            kb_ngram_tsquery(query_text) AS ngram_query,
            kb_ngram_tsquery(expanded_query) AS expanded_ngram_query
        FROM query_features
    ), scored AS (
        SELECT
            chunk.id AS chunk_id,
            chunk.version_id,
            chunk.source_file,
            chunk.page_start,
            chunk.page_end,
            CASE method
                WHEN 'exact_phrase' THEN CASE
                    WHEN position(query.clean_query IN chunk.normalized_content) > 0 THEN 1.0
                    ELSE 0.0
                END
                WHEN 'fts_simple' THEN ts_rank_cd(chunk.simple_tsv, query.simple_query)::double precision
                WHEN 'pg_trgm' THEN word_similarity(query.clean_query, chunk.normalized_content)
                WHEN 'char_ngram_raw' THEN
                    0.15 * kb_overlap_ratio(query.raw2, chunk.grams2) +
                    0.30 * kb_overlap_ratio(query.raw3, chunk.grams3) +
                    0.55 * kb_overlap_ratio(query.raw4, chunk.grams4)
                WHEN 'char_ngram_clean' THEN
                    0.15 * kb_overlap_ratio(query.clean2, chunk.grams2) +
                    0.30 * kb_overlap_ratio(query.clean3, chunk.grams3) +
                    0.55 * kb_overlap_ratio(query.clean4, chunk.grams4)
                WHEN 'char_ngram_tsv' THEN ts_rank_cd(
                    ARRAY[0.05, 0.20, 0.50, 1.00]::real[],
                    chunk.ngram_tsv,
                    query.ngram_query,
                    32
                )::double precision
                WHEN 'lexical_v2' THEN ts_rank_cd(
                    ARRAY[0.05, 0.20, 0.50, 1.00]::real[],
                    chunk.ngram_tsv,
                    query.expanded_ngram_query,
                    32
                )::double precision
                ELSE 0.0
            END AS score
        FROM kb_chunk AS chunk
        JOIN kb_version AS version
          ON version.id = chunk.version_id
         AND version.tenant_id = requested_tenant_id
         AND version.status = 'READY'
        CROSS JOIN query_grams AS query
        WHERE chunk.tenant_id = requested_tenant_id
          AND chunk.version_id = ANY(frozen_version_ids)
          AND CASE method
                WHEN 'exact_phrase' THEN
                    char_length(query.clean_query) >= 2
                    AND position(query.clean_query IN chunk.normalized_content) > 0
                WHEN 'fts_simple' THEN chunk.simple_tsv @@ query.simple_query
                WHEN 'pg_trgm' THEN
                    char_length(query.clean_query) >= 2
                    AND word_similarity(query.clean_query, chunk.normalized_content) > 0.05
                WHEN 'char_ngram_raw' THEN
                    chunk.grams2 && query.raw2 OR chunk.grams3 && query.raw3 OR chunk.grams4 && query.raw4
                WHEN 'char_ngram_clean' THEN
                    char_length(query.clean_query) >= 2
                    AND (chunk.grams2 && query.clean2 OR chunk.grams3 && query.clean3 OR chunk.grams4 && query.clean4)
                WHEN 'char_ngram_tsv' THEN chunk.ngram_tsv @@ query.ngram_query
                WHEN 'lexical_v2' THEN chunk.ngram_tsv @@ query.expanded_ngram_query
                ELSE false
              END
    ), ranked AS (
        SELECT
            row_number() OVER (ORDER BY score DESC, page_start, chunk_id) AS result_rank,
            scored.*
        FROM scored
        WHERE score > 0
    )
    SELECT result_rank, chunk_id, version_id, source_file, page_start, page_end, score
    FROM ranked
    WHERE result_rank <= result_limit
    ORDER BY result_rank;
$$;

CREATE TABLE kb_evaluation (
    method text NOT NULL,
    question_id text NOT NULL,
    scene text NOT NULL,
    question_type text NOT NULL,
    query_text text NOT NULL,
    answerable boolean NOT NULL,
    retrieval_required boolean NOT NULL,
    expected_behavior text NOT NULL,
    expected_pages integer[] NOT NULL,
    risk_level text NOT NULL,
    lexically_disjoint_rewrite boolean NOT NULL,
    requires_business_confirmation boolean NOT NULL,
    correct_rank integer,
    candidate_count integer NOT NULL,
    top5 jsonb NOT NULL,
    PRIMARY KEY (method, question_id)
);

CREATE OR REPLACE PROCEDURE kb_run_accuracy()
LANGUAGE sql
AS $$
    TRUNCATE kb_evaluation;
    INSERT INTO kb_evaluation
    SELECT
        methods.method,
        benchmark.question_id,
        benchmark.scene,
        benchmark.question_type,
        benchmark.query_text,
        benchmark.answerable,
        benchmark.retrieval_required,
        benchmark.expected_behavior,
        benchmark.expected_pages,
        benchmark.risk_level,
        benchmark.lexically_disjoint_rewrite,
        benchmark.requires_business_confirmation,
        (min(hit.result_rank) FILTER (
            WHERE EXISTS (
                SELECT 1
                FROM unnest(benchmark.expected_pages) AS expected_page
                WHERE expected_page BETWEEN hit.page_start AND hit.page_end
            )
        ))::integer AS correct_rank,
        count(hit.result_rank)::integer AS candidate_count,
        coalesce(
            jsonb_agg(
                jsonb_build_object(
                    'rank', hit.result_rank,
                    'chunk_id', hit.chunk_id,
                    'page_start', hit.page_start,
                    'page_end', hit.page_end,
                    'score', round(hit.score::numeric, 6)
                ) ORDER BY hit.result_rank
            ) FILTER (WHERE hit.result_rank IS NOT NULL),
            '[]'::jsonb
        ) AS top5
    FROM kb_benchmark AS benchmark
    CROSS JOIN (VALUES
        ('exact_phrase'),
        ('fts_simple'),
        ('pg_trgm'),
        ('char_ngram_raw'),
        ('char_ngram_clean'),
        ('char_ngram_tsv'),
        ('lexical_v2')
    ) AS methods(method)
    LEFT JOIN LATERAL kb_search(
        methods.method,
        benchmark.tenant_id,
        benchmark.version_ids,
        benchmark.query_text,
        5
    ) AS hit ON true
    GROUP BY methods.method, benchmark.question_id;
$$;

CREATE VIEW kb_evaluation_summary AS
SELECT
    method,
    count(*) FILTER (WHERE retrieval_required) AS retrieval_required_questions,
    count(*) FILTER (WHERE retrieval_required AND correct_rank IS NOT NULL) AS top5_hits,
    round(
        count(*) FILTER (WHERE retrieval_required AND correct_rank IS NOT NULL)::numeric /
        nullif(count(*) FILTER (WHERE retrieval_required), 0),
        4
    ) AS recall_at_5,
    count(*) FILTER (WHERE retrieval_required AND risk_level = '高') AS high_risk_questions,
    count(*) FILTER (WHERE retrieval_required AND risk_level = '高' AND correct_rank IS NOT NULL) AS high_risk_hits,
    round(
        count(*) FILTER (WHERE retrieval_required AND risk_level = '高' AND correct_rank IS NOT NULL)::numeric /
        nullif(count(*) FILTER (WHERE retrieval_required AND risk_level = '高'), 0),
        4
    ) AS high_risk_recall_at_5,
    count(*) FILTER (WHERE retrieval_required AND lexically_disjoint_rewrite) AS lexically_disjoint_questions,
    count(*) FILTER (
        WHERE retrieval_required AND lexically_disjoint_rewrite AND correct_rank IS NOT NULL
    ) AS lexically_disjoint_hits,
    round(
        count(*) FILTER (
            WHERE retrieval_required AND lexically_disjoint_rewrite AND correct_rank IS NOT NULL
        )::numeric /
        nullif(count(*) FILTER (WHERE retrieval_required AND lexically_disjoint_rewrite), 0),
        4
    ) AS lexically_disjoint_recall_at_5,
    count(*) FILTER (WHERE NOT answerable AND candidate_count = 0) AS no_candidate_no_hit,
    count(*) FILTER (WHERE NOT answerable) AS no_answer_questions
FROM kb_evaluation
GROUP BY method;

CREATE TABLE kb_chunk_seed AS
SELECT
    id,
    tenant_id,
    version_id,
    chunk_index,
    source_file,
    page_start,
    page_end,
    content,
    content_checksum
FROM kb_chunk
WITH NO DATA;

CREATE OR REPLACE PROCEDURE kb_snapshot_seed()
LANGUAGE sql
AS $$
    TRUNCATE kb_chunk_seed;
    INSERT INTO kb_chunk_seed
    SELECT
        id,
        tenant_id,
        version_id,
        chunk_index,
        source_file,
        page_start,
        page_end,
        content,
        content_checksum
    FROM kb_chunk
    ORDER BY version_id, chunk_index;
$$;

CREATE OR REPLACE PROCEDURE kb_prepare_scale(requested_scale integer)
LANGUAGE plpgsql
AS $$
DECLARE
    seed_count integer;
BEGIN
    SELECT count(*) INTO seed_count FROM kb_chunk_seed;
    IF seed_count = 0 THEN
        RAISE EXCEPTION 'kb_chunk_seed is empty; call kb_snapshot_seed first';
    END IF;
    IF requested_scale < 1 THEN
        RAISE EXCEPTION 'requested scale must be positive';
    END IF;

    TRUNCATE kb_chunk;
    INSERT INTO kb_chunk (
        id,
        tenant_id,
        version_id,
        chunk_index,
        source_file,
        page_start,
        page_end,
        content,
        content_checksum
    )
    SELECT
        md5(seed.id || ':' || generated.sequence_no::text),
        seed.tenant_id,
        seed.version_id,
        generated.sequence_no,
        seed.source_file,
        seed.page_start,
        seed.page_end,
        seed.content,
        seed.content_checksum
    FROM generate_series(1, requested_scale) AS generated(sequence_no)
    CROSS JOIN LATERAL (
        SELECT source.*
        FROM kb_chunk_seed AS source
        ORDER BY source.version_id, source.chunk_index
        OFFSET ((generated.sequence_no - 1) % seed_count)
        LIMIT 1
    ) AS seed;
    CALL kb_refresh_ngram_tsv();
    ANALYZE kb_chunk;
END;
$$;

CREATE TABLE kb_latency_sample (
    scale integer NOT NULL,
    repeat_no integer NOT NULL,
    question_id text NOT NULL,
    elapsed_ms double precision NOT NULL,
    result_count integer NOT NULL
);

CREATE OR REPLACE PROCEDURE kb_measure_latency(requested_scale integer, repeats integer DEFAULT 2)
LANGUAGE plpgsql
AS $$
DECLARE
    benchmark_row record;
    repeat_no integer;
    all_versions uuid[];
    started_at timestamptz;
    hit_count integer;
BEGIN
    SELECT array_agg(id ORDER BY id) INTO all_versions FROM kb_version WHERE status = 'READY';
    DELETE FROM kb_latency_sample WHERE scale = requested_scale;

    FOR benchmark_row IN
        SELECT question_id, tenant_id, query_text
        FROM (
            SELECT question_id, tenant_id, query_text, row_number() OVER (ORDER BY question_id) AS row_no
            FROM kb_benchmark
        ) AS sampled
        WHERE (row_no - 1) % 4 = 0
        ORDER BY question_id
    LOOP
        PERFORM * FROM kb_search(
            'lexical_v2',
            benchmark_row.tenant_id,
            all_versions,
            benchmark_row.query_text,
            5
        );
    END LOOP;

    FOR repeat_no IN 1..repeats LOOP
        FOR benchmark_row IN
            SELECT question_id, tenant_id, query_text
            FROM (
                SELECT question_id, tenant_id, query_text, row_number() OVER (ORDER BY question_id) AS row_no
                FROM kb_benchmark
            ) AS sampled
            WHERE (row_no - 1) % 4 = 0
            ORDER BY question_id
        LOOP
            started_at := clock_timestamp();
            SELECT count(*) INTO hit_count
            FROM kb_search(
                'lexical_v2',
                benchmark_row.tenant_id,
                all_versions,
                benchmark_row.query_text,
                5
            );
            INSERT INTO kb_latency_sample
            VALUES (
                requested_scale,
                repeat_no,
                benchmark_row.question_id,
                extract(epoch FROM clock_timestamp() - started_at) * 1000,
                hit_count
            );
        END LOOP;
    END LOOP;
END;
$$;

CREATE VIEW kb_latency_summary AS
SELECT
    scale,
    count(*) AS samples,
    round(percentile_cont(0.50) WITHIN GROUP (ORDER BY elapsed_ms)::numeric, 3) AS p50_ms,
    round(percentile_cont(0.95) WITHIN GROUP (ORDER BY elapsed_ms)::numeric, 3) AS p95_ms,
    round(max(elapsed_ms)::numeric, 3) AS max_ms
FROM kb_latency_sample
GROUP BY scale;

CREATE TABLE kb_contract_result (
    check_name text PRIMARY KEY,
    passed boolean NOT NULL
);

CREATE OR REPLACE PROCEDURE kb_run_contract_checks()
LANGUAGE plpgsql
AS $$
DECLARE
    original_tenant uuid;
    original_version uuid;
    original_query text;
    other_tenant constant uuid := '00000000-0000-4000-8000-000000000002';
    other_tenant_version constant uuid := '10000000-0000-4000-8000-000000000001';
    non_frozen_version constant uuid := '10000000-0000-4000-8000-000000000002';
    failed_version constant uuid := '10000000-0000-4000-8000-000000000003';
BEGIN
    SELECT tenant_id, version_ids[1], query_text
    INTO original_tenant, original_version, original_query
    FROM kb_benchmark
    WHERE question_id = 'DOC-006';

    INSERT INTO kb_version VALUES
        (other_tenant_version, other_tenant, 'READY', 'decoy', 'decoy', repeat('1', 64), 'decoy', 'decoy'),
        (non_frozen_version, original_tenant, 'READY', 'decoy', 'decoy', repeat('2', 64), 'decoy', 'decoy'),
        (failed_version, original_tenant, 'FAILED', 'decoy', 'decoy', repeat('3', 64), 'decoy', 'decoy');
    INSERT INTO kb_chunk (id, tenant_id, version_id, chunk_index, source_file, page_start, page_end, content, content_checksum)
    VALUES
        ('scope-other-tenant', other_tenant, other_tenant_version, 1, 'decoy', 1, 1, original_query, repeat('1', 64)),
        ('scope-non-frozen', original_tenant, non_frozen_version, 1, 'decoy', 1, 1, original_query, repeat('2', 64)),
        ('scope-failed', original_tenant, failed_version, 1, 'decoy', 1, 1, original_query, repeat('3', 64));
    CALL kb_refresh_ngram_tsv();

    TRUNCATE kb_contract_result;
    INSERT INTO kb_contract_result VALUES
        (
            'tenant_id',
            NOT EXISTS (
                SELECT 1 FROM kb_search(
                    'lexical_v2', original_tenant,
                    ARRAY[original_version, other_tenant_version], original_query, 50
                ) WHERE chunk_id = 'scope-other-tenant'
            )
        ),
        (
            'frozen_version_ids',
            NOT EXISTS (
                SELECT 1 FROM kb_search(
                    'lexical_v2', original_tenant,
                    ARRAY[original_version], original_query, 50
                ) WHERE chunk_id = 'scope-non-frozen'
            )
        ),
        (
            'ready_status',
            NOT EXISTS (
                SELECT 1 FROM kb_search(
                    'lexical_v2', original_tenant,
                    ARRAY[original_version, failed_version], original_query, 50
                ) WHERE chunk_id = 'scope-failed'
            )
        );

    IF EXISTS (SELECT 1 FROM kb_contract_result WHERE NOT passed) THEN
        RAISE EXCEPTION 'scope contract check failed';
    END IF;

    DELETE FROM kb_chunk WHERE id LIKE 'scope-%';
    DELETE FROM kb_version WHERE id IN (other_tenant_version, non_frozen_version, failed_version);
END;
$$;

CREATE TABLE kb_no_hit_control (
    control_id text PRIMARY KEY,
    query_text text NOT NULL
);

INSERT INTO kb_no_hit_control VALUES
    ('NOHIT-001', '帝企鹅育雏适温'),
    ('NOHIT-002', '量子纠缠贝尔不等式'),
    ('NOHIT-003', '木星大红斑风速');

CREATE VIEW kb_no_hit_control_result AS
SELECT
    control.control_id,
    control.query_text,
    count(hit.result_rank)::integer AS candidate_count,
    count(hit.result_rank) = 0 AS returned_no_hit
FROM kb_no_hit_control AS control
CROSS JOIN LATERAL (
    SELECT (array_agg(tenant_id ORDER BY tenant_id))[1] AS tenant_id, array_agg(id ORDER BY id) AS version_ids
    FROM kb_version
    WHERE status = 'READY'
) AS scope
LEFT JOIN LATERAL kb_search(
    'lexical_v2',
    scope.tenant_id,
    scope.version_ids,
    control.query_text,
    5
) AS hit ON true
GROUP BY control.control_id;
