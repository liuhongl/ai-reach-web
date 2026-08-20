#!/usr/bin/env python3
"""One-shot accuracy run for the frozen synthetic holdout set."""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import time
import unicodedata
from pathlib import Path

import run as m0


BASE_DIR = m0.ROOT / "outputs/knowledge-retrieval-evaluation-20260818"
VALIDATION_DIR = m0.ROOT / "outputs/knowledge-retrieval-validation-20260819"
INPUT_PATH = VALIDATION_DIR / "validation-set.jsonl"
FROZEN_DIR = VALIDATION_DIR / "m0"
FROZEN_HASHES = {
    "retrieval.sql": "16c0ea750c39f0813cc72172a5a63eb66538dfe0a5331e1fb7bbde7b30f1462e",
    "run.py": "bb6651bb717f7c45d2f02485e438b483cd9f6cfb521b19e31f7296c70dfdf6e6",
    "chunks.jsonl": "cefafe55c20e62da13c7bac6ef2f9630ed7e883030333e07b652cd51055221b4",
    "development-benchmark.jsonl": "f79ed6195170c5147b888e438b7b030de8b361fac693c2a94b6643a5401768c5",
}


def lexical_normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).lower()
    return "".join(
        char
        for char in normalized
        if not char.isspace() and not unicodedata.category(char).startswith("P")
    )


def ngrams(value: str, width: int = 2) -> set[str]:
    normalized = lexical_normalize(value)
    return {normalized[index : index + width] for index in range(len(normalized) - width + 1)}


def jaccard(left: str, right: str) -> float:
    left_grams, right_grams = ngrams(left), ngrams(right)
    union = left_grams | right_grams
    return len(left_grams & right_grams) / len(union) if union else 0.0


def assert_frozen_retriever() -> None:
    paths = {
        "retrieval.sql": Path(__file__).with_name("retrieval.sql"),
        "run.py": Path(__file__).with_name("run.py"),
        "chunks.jsonl": BASE_DIR / "m0/chunks.jsonl",
        "development-benchmark.jsonl": BASE_DIR / "m0/benchmark.jsonl",
    }
    actual = {name: m0.sha256(path) for name, path in paths.items()}
    if actual != FROZEN_HASHES:
        raise RuntimeError(f"retriever freeze mismatch: expected {FROZEN_HASHES}, found {actual}")


def prepare() -> dict:
    assert_frozen_retriever()
    rows = m0.read_jsonl(INPUT_PATH)
    development = m0.read_jsonl(BASE_DIR / "m0/benchmark.jsonl")
    chunks = m0.read_jsonl(BASE_DIR / "m0/chunks.jsonl")
    versions = m0.read_jsonl(BASE_DIR / "m0/versions.jsonl")
    version_by_scene = {row["scene"]: row["id"] for row in versions}
    chunks_by_source_page: dict[tuple[str, int], list[str]] = {}
    for chunk in chunks:
        chunks_by_source_page.setdefault(
            (chunk["source_file"], chunk["page_start"]), []
        ).append(chunk["content"])

    development_ids = {row["question_id"] for row in development}
    development_queries = {row["query"] for row in development}
    if len(rows) != 120 or len({row["question_id"] for row in rows}) != 120:
        raise RuntimeError("validation set must contain 120 unique question ids")
    if {row["question_id"] for row in rows} & development_ids:
        raise RuntimeError("validation question ids overlap the development set")
    if {row["query"] for row in rows} & development_queries:
        raise RuntimeError("validation queries overlap the development set")

    for row in rows:
        if row["scene"] not in version_by_scene:
            raise RuntimeError(f"unknown scene: {row['scene']}")
        if row["expected_behavior"] == "ANSWER" and not row["retrieval_required"]:
            raise RuntimeError(f"ANSWER question must require retrieval: {row['question_id']}")
        if row["retrieval_required"] and not row["source_pages"]:
            raise RuntimeError(f"retrieval question has no source page: {row['question_id']}")
        source_parts = []
        for page in row["source_pages"]:
            parts = chunks_by_source_page.get((row["source_file"], page), [])
            if not parts:
                raise RuntimeError(f"missing source page {page}: {row['question_id']}")
            source_parts.extend(parts)
        row["lexically_disjoint_rewrite"] = bool(
            row["retrieval_required"]
            and not (ngrams(row["query"]) & ngrams("\n".join(source_parts)))
        )
        row["tenant_id"] = str(m0.TENANT_ID)
        row["version_ids"] = [version_by_scene[row["scene"]]]

    contract = {
        "questions": len(rows),
        "answerable": sum(row["answerable"] for row in rows),
        "retrieval_required": sum(row["retrieval_required"] for row in rows),
        "clarify": sum(row["expected_behavior"] == "CLARIFY" for row in rows),
        "no_answer": sum(not row["answerable"] for row in rows),
    }
    expected = {
        "questions": 120,
        "answerable": 102,
        "retrieval_required": 90,
        "clarify": 12,
        "no_answer": 18,
    }
    if contract != expected:
        raise RuntimeError(f"validation contract mismatch: expected {expected}, found {contract}")

    FROZEN_DIR.mkdir(parents=True, exist_ok=True)
    m0.write_jsonl(FROZEN_DIR / "benchmark.jsonl", rows)
    load_dir = FROZEN_DIR / "load"
    m0.write_tsv(
        load_dir / "benchmark.tsv",
        [
            [
                row["question_id"],
                row["tenant_id"],
                "{" + ",".join(row["version_ids"]) + "}",
                row["scene"],
                row["question_type"],
                row["query"],
                "t" if row["answerable"] else "f",
                "t" if row["retrieval_required"] else "f",
                row["expected_behavior"],
                "{" + ",".join(str(page) for page in row["source_pages"]) + "}",
                row["risk_level"],
                "t" if row["lexically_disjoint_rewrite"] else "f",
                "t" if row["requires_business_confirmation"] else "f",
                row["business_review_status"],
            ]
            for row in rows
        ],
    )

    nearest = [max(jaccard(row["query"], dev["query"]) for dev in development) for row in rows]
    return {
        **contract,
        "dataset_role": "independent-synthetic-holdout",
        "contains_real_customer_utterances": False,
        "source_files": len({row["source_file"] for row in rows}),
        "lexically_disjoint_questions": sum(
            row["retrieval_required"] and row["lexically_disjoint_rewrite"] for row in rows
        ),
        "high_risk_retrieval_questions": sum(
            row["retrieval_required"] and row["risk_level"] == "高" for row in rows
        ),
        "exact_query_overlap_with_development": 0,
        "max_bigram_jaccard_with_development": round(max(nearest), 4),
        "near_duplicate_queries_at_0_8": sum(score >= 0.8 for score in nearest),
        "retriever_frozen_before_generation": True,
        "frozen_hashes": FROZEN_HASHES,
        "source_validation_set_sha256": m0.sha256(INPUT_PATH),
        "frozen_benchmark_sha256": m0.sha256(FROZEN_DIR / "benchmark.jsonl"),
    }


def export_csv(container: str, query: str, path: Path) -> None:
    m0.export_csv(container, query, path)


def build_manifest() -> None:
    paths = [
        Path(__file__),
        Path(__file__).with_name("retrieval.sql"),
        INPUT_PATH,
        BASE_DIR / "m0/chunks.jsonl",
        BASE_DIR / "m0/versions.jsonl",
        FROZEN_DIR / "benchmark.jsonl",
        *sorted(path for path in (FROZEN_DIR / "results").glob("*.*") if path.is_file()),
    ]
    lines = [f"{m0.sha256(path)}  {path.relative_to(m0.ROOT)}" for path in paths]
    (FROZEN_DIR / "manifest.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_accuracy(prepared: dict) -> dict:
    docker = shutil.which("docker")
    if not docker:
        raise RuntimeError("docker is required")
    results_dir = FROZEN_DIR / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    container = f"ai-reach-kb-validation-{os.getpid()}"
    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    image_id = m0.run_command(
        [docker, "image", "inspect", "--format", "{{.Id}}", m0.POSTGRES_IMAGE]
    ).decode().strip()
    m0.run_command(
        [
            docker,
            "run",
            "--rm",
            "-d",
            "--name",
            container,
            "-e",
            "POSTGRES_PASSWORD=m0-validation-local-only",
            m0.POSTGRES_IMAGE,
        ]
    )
    try:
        for _ in range(60):
            logs = subprocess.run([docker, "logs", container], capture_output=True, check=False)
            initialized = b"PostgreSQL init process complete; ready for start up." in (
                logs.stdout + logs.stderr
            )
            ready = subprocess.run(
                [docker, "exec", container, "psql", "-X", "-U", "postgres", "-c", "SELECT 1"],
                capture_output=True,
                check=False,
            )
            if initialized and ready.returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError("PostgreSQL did not finish initialization in 60 seconds")

        m0.psql(container, Path(__file__).with_name("retrieval.sql").read_text(encoding="utf-8"), quiet=False)
        m0.copy_to_postgres(
            container,
            "kb_version(id,tenant_id,status,scene,source_file,source_sha256,parser_version,chunk_strategy_version)",
            BASE_DIR / "m0/load/versions.tsv",
        )
        m0.copy_to_postgres(
            container,
            "kb_chunk(id,tenant_id,version_id,chunk_index,source_file,page_start,page_end,content,content_checksum)",
            BASE_DIR / "m0/load/chunks.tsv",
        )
        m0.copy_to_postgres(
            container,
            "kb_benchmark(question_id,tenant_id,version_ids,scene,question_type,query_text,answerable,retrieval_required,expected_behavior,expected_pages,risk_level,lexically_disjoint_rewrite,requires_business_confirmation,business_review_status)",
            FROZEN_DIR / "load/benchmark.tsv",
        )
        m0.psql(container, "CALL kb_refresh_ngram_tsv(); ANALYZE; CALL kb_run_accuracy();")
        export_csv(
            container,
            "SELECT method, retrieval_required_questions, top5_hits, recall_at_5, high_risk_questions, high_risk_hits, high_risk_recall_at_5, lexically_disjoint_questions, lexically_disjoint_hits, lexically_disjoint_recall_at_5, no_candidate_no_hit, no_answer_questions FROM kb_evaluation_summary ORDER BY recall_at_5 DESC, method",
            results_dir / "accuracy-summary.csv",
        )
        export_csv(
            container,
            "SELECT method, question_id, scene, question_type, query_text, kb_expand_query(query_text) AS retrieval_query, answerable, retrieval_required, expected_behavior, expected_pages::text, risk_level, lexically_disjoint_rewrite, requires_business_confirmation, correct_rank, candidate_count, top5::text FROM kb_evaluation ORDER BY method, question_id",
            results_dir / "accuracy-by-question.csv",
        )
        export_csv(
            container,
            "SELECT question_id, scene, question_type, query_text, kb_expand_query(query_text) AS retrieval_query, expected_pages::text, risk_level, lexically_disjoint_rewrite, candidate_count, top5::text FROM kb_evaluation WHERE method = 'lexical_v2' AND retrieval_required AND correct_rank IS NULL ORDER BY question_id",
            results_dir / "lexical-v2-misses.csv",
        )
    finally:
        subprocess.run([docker, "rm", "-f", container], capture_output=True, check=False)

    with (results_dir / "accuracy-summary.csv").open(encoding="utf-8", newline="") as stream:
        accuracy = {row["method"]: row for row in csv.DictReader(stream)}
    best = accuracy["lexical_v2"]
    gate_passed = (
        float(best["recall_at_5"]) >= 0.95
        and float(best["high_risk_recall_at_5"]) == 1.0
        and float(best["lexically_disjoint_recall_at_5"] or 0) >= 0.90
    )
    summary = {
        **prepared,
        "started_at_utc": started_at,
        "completed_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "git_commit": m0.run_command(["git", "-C", str(m0.ROOT), "rev-parse", "HEAD"]).decode().strip(),
        "git_branch": m0.run_command(["git", "-C", str(m0.ROOT), "branch", "--show-current"]).decode().strip(),
        "postgres_image": m0.POSTGRES_IMAGE,
        "postgres_image_id": image_id,
        "best_candidate": {
            "method": "lexical_v2",
            "top5_hits": int(best["top5_hits"]),
            "retrieval_required_questions": int(best["retrieval_required_questions"]),
            "recall_at_5": float(best["recall_at_5"]),
            "high_risk_hits": int(best["high_risk_hits"]),
            "high_risk_questions": int(best["high_risk_questions"]),
            "high_risk_recall_at_5": float(best["high_risk_recall_at_5"]),
            "lexically_disjoint_hits": int(best["lexically_disjoint_hits"]),
            "lexically_disjoint_questions": int(best["lexically_disjoint_questions"]),
            "lexically_disjoint_recall_at_5": float(best["lexically_disjoint_recall_at_5"] or 0),
        },
        "validation_accuracy_gate_passed": gate_passed,
        "quality_gate_passed": False,
        "milestone_0_status": "BLOCKED",
        "blockers": [
            "the independent holdout is synthetic and does not prove coverage of real customer utterances",
            "100-chunk latency is not yet measured on the target PostgreSQL host under representative concurrency and cold/warm cache",
            "the final production parser and chunker versions are not implemented and matched yet",
        ],
    }
    (FROZEN_DIR / "run-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    build_manifest()
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prepare-only", action="store_true")
    args = parser.parse_args()
    summary = prepare()
    if not args.prepare_only:
        summary = run_accuracy(summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
