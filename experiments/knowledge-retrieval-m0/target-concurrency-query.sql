SELECT chunk.id
FROM ai_call_knowledge_chunk AS chunk
JOIN ai_call_knowledge_version AS version
  ON version.id = chunk.knowledge_version_id
 AND version.tenant_id = chunk.tenant_id
CROSS JOIN LATERAL (
    SELECT ai_call_knowledge_ngram_tsquery(
        '退款审核后多久原路退回'
    ) AS query_value
) AS query_features
WHERE chunk.tenant_id = 'm0-bench-concurrent'
  AND chunk.knowledge_version_id = ANY(ARRAY[-91510::bigint])
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
