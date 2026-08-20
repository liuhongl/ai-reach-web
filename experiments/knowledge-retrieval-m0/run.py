#!/usr/bin/env python3
"""Reproducible PostgreSQL lexical-retrieval milestone-0 experiment."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import time
import unicodedata
import uuid
import zipfile
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = ROOT / "outputs/knowledge-retrieval-evaluation-20260818"
TENANT_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
PARSER_VERSION = "pptx-ooxml-stdlib-v1"
CHUNK_STRATEGY_VERSION = "pptx-slide-semantic-900-1200-v1"
POSTGRES_IMAGE = "postgres:16.14-alpine"
QUERY_CONTRACT_VERSION = "raw-query+deterministic-canonicalization-v1"
TEXT_TAG = "{http://schemas.openxmlformats.org/drawingml/2006/main}t"
PARAGRAPH_TAG = "{http://schemas.openxmlformats.org/drawingml/2006/main}p"
SLIDE_RE = re.compile(r"ppt/slides/slide(\d+)\.xml$")
SOURCE_PAGE_CORRECTIONS = {
    "DOC-009": [3, 13],
    "HAR-010": [7],
    "REC-012": [6],
}
LEXICALLY_DISJOINT_IDS = {"DOC-010", "REC-007", "REC-009", "REC-015"}
NO_ANSWER_RESPONSE = "资料暂未明确，需要业务顾问进一步沟通。"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def normalized_text(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value)).strip()


def extract_slides(path: Path) -> list[tuple[int, str]]:
    slides: list[tuple[int, str]] = []
    with zipfile.ZipFile(path) as archive:
        names = sorted(
            (name for name in archive.namelist() if SLIDE_RE.fullmatch(name)),
            key=lambda name: int(SLIDE_RE.fullmatch(name).group(1)),
        )
        for name in names:
            page = int(SLIDE_RE.fullmatch(name).group(1))
            root = ElementTree.fromstring(archive.read(name))
            paragraphs = []
            for paragraph in root.iter(PARAGRAPH_TAG):
                text = normalized_text("".join(node.text or "" for node in paragraph.iter(TEXT_TAG)))
                if text:
                    paragraphs.append(text)
            slides.append((page, "\n".join(paragraphs)))
    return slides


def split_long_text(text: str, target: int = 900, maximum: int = 1200) -> list[str]:
    if len(text) <= maximum:
        return [text] if text else []
    parts = [part.strip() for part in re.split(r"(?<=[。！？!?；;])|\n+", text) if part.strip()]
    chunks: list[str] = []
    current = ""
    for part in parts:
        while len(part) > maximum:
            if current:
                chunks.append(current)
                current = ""
            chunks.append(part[:maximum])
            part = part[maximum:]
        candidate = f"{current}\n{part}".strip() if current else part
        if current and len(candidate) > maximum:
            chunks.append(current)
            current = part
        else:
            current = candidate
        if len(current) >= target:
            chunks.append(current)
            current = ""
    if current:
        chunks.append(current)
    return chunks


def read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as stream:
        return [json.loads(line) for line in stream if line.strip()]


def write_jsonl(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as stream:
        for record in records:
            stream.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")


def write_tsv(path: Path, rows: list[list[object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream, delimiter="\t", quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
        writer.writerows(rows)


def freeze_benchmark(benchmark: list[dict]) -> None:
    for row in benchmark:
        question_id = row["question_id"]
        if question_id in SOURCE_PAGE_CORRECTIONS:
            row["source_pages"] = SOURCE_PAGE_CORRECTIONS[question_id]
            row["source_page_label"] = "、".join(map(str, row["source_pages"]))
        row["retrieval_required"] = row["expected_behavior"] == "ANSWER"
        row["lexically_disjoint_rewrite"] = question_id in LEXICALLY_DISJOINT_IDS
        if row["requires_business_confirmation"]:
            row["business_review_status"] = "已确认（按资料）" if row["answerable"] else "转业务顾问"
        if not row["answerable"]:
            row["provisional_answer"] = NO_ANSWER_RESPONSE

    checks = {
        "questions": len(benchmark),
        "answerable": sum(row["answerable"] for row in benchmark),
        "retrieval_required": sum(row["retrieval_required"] for row in benchmark),
        "no_answer": sum(not row["answerable"] for row in benchmark),
        "lexically_disjoint": sum(row["lexically_disjoint_rewrite"] for row in benchmark),
        "pending": sum(row["business_review_status"] == "待确认" for row in benchmark),
    }
    expected = {
        "questions": 120,
        "answerable": 102,
        "retrieval_required": 90,
        "no_answer": 18,
        "lexically_disjoint": 4,
        "pending": 0,
    }
    if checks != expected:
        raise RuntimeError(f"benchmark contract mismatch: expected {expected}, found {checks}")


def prepare(data_dir: Path) -> dict:
    corpus_dir = data_dir / "corpus"
    m0_dir = data_dir / "m0"
    benchmark_path = m0_dir / "benchmark.jsonl"
    benchmark = read_jsonl(benchmark_path)
    freeze_benchmark(benchmark)
    sources = {(row["scene"], row["source_file"]) for row in benchmark}
    if len(sources) != 6:
        raise RuntimeError(f"expected 6 scene/source pairs, found {len(sources)}")

    manifests: list[dict] = []
    versions: list[dict] = []
    chunks: list[dict] = []
    scene_versions: dict[str, uuid.UUID] = {}

    for scene, filename in sorted(sources):
        source = corpus_dir / filename
        if not source.is_file():
            raise FileNotFoundError(source)
        source_hash = sha256(source)
        version_id = uuid.uuid5(uuid.NAMESPACE_URL, f"ai-reach-m0:{source_hash}")
        scene_versions[scene] = version_id
        slides = extract_slides(source)
        manifest = {
            "scene": scene,
            "source_file": filename,
            "relative_path": str(source.relative_to(ROOT)),
            "byte_size": source.stat().st_size,
            "sha256": source_hash,
            "slide_count": len(slides),
            "nonempty_slide_count": sum(bool(text) for _, text in slides),
        }
        manifests.append(manifest)
        versions.append(
            {
                "id": str(version_id),
                "tenant_id": str(TENANT_ID),
                "status": "READY",
                **manifest,
                "parser_version": PARSER_VERSION,
                "chunk_strategy_version": CHUNK_STRATEGY_VERSION,
            }
        )
        chunk_index = 0
        for page, slide_text in slides:
            for part_index, content in enumerate(split_long_text(slide_text), start=1):
                content_hash = hashlib.sha256(content.encode()).hexdigest()
                chunk_id = hashlib.sha256(
                    f"{version_id}:{chunk_index}:{content_hash}".encode()
                ).hexdigest()
                chunks.append(
                    {
                        "id": chunk_id,
                        "tenant_id": str(TENANT_ID),
                        "version_id": str(version_id),
                        "scene": scene,
                        "source_file": filename,
                        "chunk_index": chunk_index,
                        "page_start": page,
                        "page_end": page,
                        "page_part": part_index,
                        "content": content,
                        "content_checksum": content_hash,
                    }
                )
                chunk_index += 1

    for row in benchmark:
        row["tenant_id"] = str(TENANT_ID)
        row["version_ids"] = [str(scene_versions[row["scene"]])]

    expected_slide_count = sum(item["slide_count"] for item in manifests)
    if expected_slide_count != 99:
        raise RuntimeError(f"expected 99 slides, extracted {expected_slide_count}")

    write_jsonl(m0_dir / "corpus-manifest.jsonl", manifests)
    write_jsonl(m0_dir / "versions.jsonl", versions)
    write_jsonl(m0_dir / "chunks.jsonl", chunks)
    write_jsonl(benchmark_path, benchmark)

    load_dir = m0_dir / "load"
    write_tsv(
        load_dir / "versions.tsv",
        [
            [
                item["id"],
                item["tenant_id"],
                item["status"],
                item["scene"],
                item["source_file"],
                item["sha256"],
                item["parser_version"],
                item["chunk_strategy_version"],
            ]
            for item in versions
        ],
    )
    write_tsv(
        load_dir / "chunks.tsv",
        [
            [
                item["id"],
                item["tenant_id"],
                item["version_id"],
                item["chunk_index"],
                item["source_file"],
                item["page_start"],
                item["page_end"],
                item["content"],
                item["content_checksum"],
            ]
            for item in chunks
        ],
    )
    write_tsv(
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
            for row in benchmark
        ],
    )

    return {
        "parser_version": PARSER_VERSION,
        "chunk_strategy_version": CHUNK_STRATEGY_VERSION,
        "source_files": len(manifests),
        "slides": expected_slide_count,
        "nonempty_slides": sum(item["nonempty_slide_count"] for item in manifests),
        "chunks": len(chunks),
        "chunk_chars": {
            "min": min(map(lambda item: len(item["content"]), chunks)),
            "max": max(map(lambda item: len(item["content"]), chunks)),
            "mean": round(sum(len(item["content"]) for item in chunks) / len(chunks), 1),
        },
        "questions": len(benchmark),
        "answerable": sum(row["answerable"] for row in benchmark),
        "retrieval_required": sum(row["retrieval_required"] for row in benchmark),
        "query_contract_version": QUERY_CONTRACT_VERSION,
        "business_confirmation_pending": sum(
            row["business_review_status"] == "待确认" for row in benchmark
        ),
        "lexically_disjoint_questions": sum(
            row["retrieval_required"] and row["lexically_disjoint_rewrite"] for row in benchmark
        ),
        "lexically_disjoint_unlabeled": sum(
            row["retrieval_required"] and row["lexically_disjoint_rewrite"] is None
            for row in benchmark
        ),
    }


def run_command(args: list[str], *, input_bytes: bytes | None = None) -> bytes:
    completed = subprocess.run(args, input=input_bytes, capture_output=True, check=False)
    if completed.returncode:
        raise RuntimeError(
            f"command failed ({completed.returncode}): {' '.join(args)}\n"
            f"{completed.stderr.decode(errors='replace')}"
        )
    return completed.stdout


def psql(container: str, sql: str, *, quiet: bool = True) -> bytes:
    args = ["docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-v", "ON_ERROR_STOP=1"]
    if quiet:
        args.extend(["-q", "-A", "-t"])
    return run_command(args, input_bytes=sql.encode())


def copy_to_postgres(container: str, table_columns: str, path: Path) -> None:
    command = f"\\copy {table_columns} FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t')\n"
    args = [
        "docker", "exec", "-i", container, "psql", "-X", "-U", "postgres",
        "-v", "ON_ERROR_STOP=1", "-q", "-c", command,
    ]
    run_command(args, input_bytes=path.read_bytes())


def export_csv(container: str, query: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    output = psql(container, f"\\copy ({query}) TO STDOUT WITH (FORMAT csv, HEADER true)\n")
    path.write_bytes(output)


def csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def build_evidence_manifest(data_dir: Path, experiment_dir: Path) -> None:
    m0_dir = data_dir / "m0"
    paths = [
        experiment_dir / "run.py",
        experiment_dir / "retrieval.sql",
        data_dir / "knowledge-retrieval-evaluation-set.xlsx",
        data_dir / "knowledge-retrieval-m0-results.xlsx",
        *sorted((data_dir / "corpus").glob("*.pptx")),
        *sorted(path for path in m0_dir.rglob("*") if path.is_file() and path.name != "manifest.sha256"),
    ]
    lines = [f"{sha256(path)}  {path.relative_to(ROOT)}" for path in sorted(set(paths))]
    (m0_dir / "manifest.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_experiment(data_dir: Path, prepare_summary: dict) -> dict:
    docker = shutil.which("docker")
    if not docker:
        raise RuntimeError("docker is required")

    experiment_dir = Path(__file__).resolve().parent
    sql_path = experiment_dir / "retrieval.sql"
    m0_dir = data_dir / "m0"
    results_dir = m0_dir / "results"
    plans_dir = results_dir / "plans"
    results_dir.mkdir(parents=True, exist_ok=True)
    plans_dir.mkdir(parents=True, exist_ok=True)
    (results_dir / "char-ngram-tsv-misses.csv").unlink(missing_ok=True)
    container = f"ai-reach-kb-m0-{os.getpid()}"
    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    image_id = run_command([docker, "image", "inspect", "--format", "{{.Id}}", POSTGRES_IMAGE]).decode().strip()

    run_command([
        docker, "run", "--rm", "-d", "--name", container,
        "-e", "POSTGRES_PASSWORD=m0-local-only", POSTGRES_IMAGE,
    ])
    try:
        for _ in range(60):
            logs = subprocess.run(
                [docker, "logs", container], capture_output=True, check=False
            )
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

        psql(container, sql_path.read_text(encoding="utf-8"), quiet=False)
        load_dir = m0_dir / "load"
        copy_to_postgres(
            container,
            "kb_version(id,tenant_id,status,scene,source_file,source_sha256,parser_version,chunk_strategy_version)",
            load_dir / "versions.tsv",
        )
        copy_to_postgres(
            container,
            "kb_chunk(id,tenant_id,version_id,chunk_index,source_file,page_start,page_end,content,content_checksum)",
            load_dir / "chunks.tsv",
        )
        copy_to_postgres(
            container,
            "kb_benchmark(question_id,tenant_id,version_ids,scene,question_type,query_text,answerable,retrieval_required,expected_behavior,expected_pages,risk_level,lexically_disjoint_rewrite,requires_business_confirmation,business_review_status)",
            load_dir / "benchmark.tsv",
        )
        psql(container, "CALL kb_refresh_ngram_tsv(); ANALYZE; CALL kb_run_accuracy(); CALL kb_run_contract_checks(); CALL kb_snapshot_seed();")

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
            "SELECT method, question_type, count(*) FILTER (WHERE retrieval_required) AS retrieval_required_questions, count(*) FILTER (WHERE retrieval_required AND correct_rank IS NOT NULL) AS top5_hits, round(count(*) FILTER (WHERE retrieval_required AND correct_rank IS NOT NULL)::numeric / nullif(count(*) FILTER (WHERE retrieval_required), 0), 4) AS recall_at_5 FROM kb_evaluation GROUP BY method, question_type ORDER BY method, question_type",
            results_dir / "accuracy-by-question-type.csv",
        )
        export_csv(
            container,
            "SELECT question_id, scene, question_type, query_text, kb_expand_query(query_text) AS retrieval_query, expected_pages::text, risk_level, lexically_disjoint_rewrite, requires_business_confirmation, candidate_count, top5::text FROM kb_evaluation WHERE method = 'lexical_v2' AND retrieval_required AND correct_rank IS NULL ORDER BY question_id",
            results_dir / "lexical-v2-misses.csv",
        )
        export_csv(
            container,
            "SELECT check_name, passed FROM kb_contract_result ORDER BY check_name",
            results_dir / "scope-contract-checks.csv",
        )
        export_csv(
            container,
            "SELECT control_id, query_text, candidate_count, returned_no_hit FROM kb_no_hit_control_result ORDER BY control_id",
            results_dir / "no-hit-controls.csv",
        )

        for scale in (100, 500, 1000, 2000):
            psql(container, f"CALL kb_prepare_scale({scale}); CALL kb_measure_latency({scale}, 2);")
            plan = psql(
                container,
                "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) "
                "SELECT * FROM kb_search("
                "'lexical_v2', "
                "(SELECT tenant_id FROM kb_benchmark ORDER BY question_id LIMIT 1), "
                "ARRAY(SELECT id FROM kb_version WHERE status = 'READY' ORDER BY id), "
                "(SELECT query_text FROM kb_benchmark ORDER BY question_id LIMIT 1), 5);",
            )
            (plans_dir / f"scale-{scale}.json").write_bytes(plan)

        export_csv(
            container,
            "SELECT scale, samples, p50_ms, p95_ms, max_ms FROM kb_latency_summary ORDER BY scale",
            results_dir / "latency-summary.csv",
        )
        export_csv(
            container,
            "SELECT scale, repeat_no, question_id, round(elapsed_ms::numeric, 6) AS elapsed_ms, result_count FROM kb_latency_sample ORDER BY scale, repeat_no, question_id",
            results_dir / "latency-samples.csv",
        )
        environment = psql(
            container,
            "SELECT jsonb_pretty(jsonb_build_object("
            "'server_version', current_setting('server_version'), "
            "'server_version_num', current_setting('server_version_num'), "
            "'pg_trgm_version', (SELECT extversion FROM pg_extension WHERE extname = 'pg_trgm'), "
            "'server_encoding', current_setting('server_encoding'), "
            "'lc_collate', (SELECT datcollate FROM pg_database WHERE datname = current_database()), "
            "'shared_buffers', current_setting('shared_buffers'), "
            "'effective_cache_size', current_setting('effective_cache_size'), "
            "'max_parallel_workers_per_gather', current_setting('max_parallel_workers_per_gather')"
            "))::text;",
        ).decode().strip()
        (results_dir / "postgres-environment.json").write_text(environment + "\n", encoding="utf-8")
    finally:
        subprocess.run([docker, "rm", "-f", container], capture_output=True, check=False)

    accuracy = {row["method"]: row for row in csv_rows(results_dir / "accuracy-summary.csv")}
    latency = csv_rows(results_dir / "latency-summary.csv")
    best = accuracy["lexical_v2"]
    scope_passed = all(row["passed"] == "t" for row in csv_rows(results_dir / "scope-contract-checks.csv"))
    no_hit_passed = all(row["returned_no_hit"] == "t" for row in csv_rows(results_dir / "no-hit-controls.csv"))
    latency_upper_bound = max(
        (int(row["scale"]) for row in latency if float(row["p95_ms"]) <= 100),
        default=None,
    )
    summary = {
        **prepare_summary,
        "started_at_utc": started_at,
        "completed_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "git_commit": run_command(["git", "-C", str(ROOT), "rev-parse", "HEAD"]).decode().strip(),
        "git_branch": run_command(["git", "-C", str(ROOT), "branch", "--show-current"]).decode().strip(),
        "host": {"platform": platform.platform(), "machine": platform.machine(), "python": sys.version.split()[0]},
        "docker": {"version": run_command([docker, "version", "--format", "{{.Server.Version}}"]).decode().strip(), "image": POSTGRES_IMAGE, "image_id": image_id},
        "best_reproducible_baseline": {
            "method": "lexical_v2",
            "top5_hits": int(best["top5_hits"]),
            "retrieval_required_questions": int(best["retrieval_required_questions"]),
            "recall_at_5": float(best["recall_at_5"]),
            "high_risk_hits": int(best["high_risk_hits"]),
            "high_risk_questions": int(best["high_risk_questions"]),
            "high_risk_recall_at_5": float(best["high_risk_recall_at_5"]),
            "lexically_disjoint_hits": int(best["lexically_disjoint_hits"]),
            "lexically_disjoint_questions": int(best["lexically_disjoint_questions"]),
            "lexically_disjoint_recall_at_5": float(best["lexically_disjoint_recall_at_5"]),
        },
        "development_accuracy_gate_passed": (
            float(best["recall_at_5"]) >= 0.95
            and float(best["high_risk_recall_at_5"]) == 1.0
            and float(best["lexically_disjoint_recall_at_5"]) >= 0.90
        ),
        "scope_contract_passed": scope_passed,
        "no_hit_zero_overlap_controls_passed": no_hit_passed,
        "latency_tested_upper_bound_chunks": latency_upper_bound,
        "max_frozen_chunks_per_task": None,
        "quality_gate_passed": False,
        "milestone_0_status": "BLOCKED",
        "blockers": [
            "the 120-question development set has been used for tuning; a separate frozen validation set is still required",
            "latency was measured on a local single-connection warm-cache Docker environment, not the target production PostgreSQL host",
            "the final production parser and chunker versions are not implemented and matched yet",
        ],
    }
    (m0_dir / "run-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    build_evidence_manifest(data_dir, experiment_dir)
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--prepare-only", action="store_true")
    args = parser.parse_args()
    summary = prepare(args.data_dir.resolve())
    if not args.prepare_only:
        summary = run_experiment(args.data_dir.resolve(), summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
