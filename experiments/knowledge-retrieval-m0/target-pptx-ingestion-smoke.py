from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import delete, select, text, update
from starlette.datastructures import Headers

from app.api.v1.ai_call.model import (
    AiCallKnowledgeChunkModel,
    AiCallKnowledgeItemModel,
    AiCallKnowledgeVersionModel,
    AiCallPromptKnowledgeBindingModel,
)
from app.config.setting import settings
from app.core.database import async_db_session
from app.services.ai_call.knowledge import KnowledgeService, build_cos_knowledge_store

PPTX_MIME_TYPE = (
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
)


async def run(source_path: Path, filename: str, tenant_id: str, user_id: int) -> None:
    with source_path.open("rb") as digest_source:
        digest = hashlib.file_digest(digest_source, "sha256").hexdigest()
    service = KnowledgeService(
        build_cos_knowledge_store(settings),
        binary_parser_enabled=bool(settings.AI_CALL_KNOWLEDGE_PARSER_SOCKET.strip()),
    )
    upload = UploadFile(
        file=source_path.open("rb"),
        filename=filename,
        headers=Headers({"content-type": PPTX_MIME_TYPE}),
    )
    item_id: int | None = None
    version_id: int | None = None
    object_key: str | None = None
    status = "PROCESSING"

    try:
        async with async_db_session() as db:
            result = await service.accept_upload(
                db,
                tenant_id=tenant_id,
                user_id=user_id,
                idempotency_key=f"pptx-118-smoke-{uuid4().hex}",
                file=upload,
                file_sha256=digest,
                content_category="OTHER",
                note="118 PPTX 工程冒烟，完成后清理",
            )
            item_id = result.item_id
            version_id = result.version_id

        for _ in range(90):
            await asyncio.sleep(1)
            async with async_db_session() as db:
                version = await db.scalar(
                    select(AiCallKnowledgeVersionModel).where(
                        AiCallKnowledgeVersionModel.id == version_id,
                        AiCallKnowledgeVersionModel.tenant_id == tenant_id,
                    )
                )
                if version is None:
                    raise RuntimeError("PPTX 冒烟版本意外丢失")
                status = version.status
                object_key = version.source_object_key
                if status in {"READY", "FAILED"}:
                    break
        else:
            raise TimeoutError("PPTX Worker 在 90 秒内未完成")

        if status != "READY":
            raise RuntimeError("PPTX Worker 未进入 READY")

        async with async_db_session() as db:
            version = await db.scalar(
                select(AiCallKnowledgeVersionModel).where(
                    AiCallKnowledgeVersionModel.id == version_id,
                    AiCallKnowledgeVersionModel.tenant_id == tenant_id,
                )
            )
            hits = (
                await db.execute(
                    text(
                        """
                        SELECT chunk.page_no, chunk.source_path
                        FROM ai_call_knowledge_chunk AS chunk
                        CROSS JOIN LATERAL (
                            SELECT ai_call_knowledge_ngram_tsquery(
                                '哪些客户更值得跟进'
                            ) AS query_value
                        ) AS query_features
                        WHERE chunk.tenant_id = :tenant_id
                          AND chunk.knowledge_version_id = :version_id
                          AND chunk.ngram_tsv @@ query_features.query_value
                        ORDER BY ts_rank_cd(
                            ARRAY[0.05, 0.20, 0.50, 1.00]::real[],
                            chunk.ngram_tsv,
                            query_features.query_value,
                            32
                        ) DESC,
                        chunk.chunk_index,
                        chunk.id
                        LIMIT 5
                        """
                    ),
                    {"tenant_id": tenant_id, "version_id": version_id},
                )
            ).mappings().all()
            pages = (
                await db.scalars(
                    select(AiCallKnowledgeChunkModel.page_no)
                    .where(
                        AiCallKnowledgeChunkModel.tenant_id == tenant_id,
                        AiCallKnowledgeChunkModel.knowledge_version_id == version_id,
                    )
                    .order_by(AiCallKnowledgeChunkModel.page_no)
                )
            ).all()

        if version is None or not hits or any(page is None for page in pages):
            raise RuntimeError("PPTX 切片或页码检索证据不完整")

        print(
            json.dumps(
                {
                    "status": version.status,
                    "parserVersion": version.parser_version,
                    "chunkStrategyVersion": version.chunk_strategy_version,
                    "chunkCount": version.chunk_count,
                    "pageNos": pages,
                    "hitPageNos": [hit["page_no"] for hit in hits],
                    "hitSourcePaths": [hit["source_path"] for hit in hits],
                },
                ensure_ascii=False,
            )
        )
    finally:
        await upload.close()
        if item_id is not None and version_id is not None and status in {"READY", "FAILED"}:
            if object_key is not None:
                await service.store.delete(object_key)
                if await service.store.stat_or_none(object_key) is not None:
                    raise RuntimeError("PPTX 冒烟 COS 原文件清理失败")
            async with async_db_session() as db:
                await db.execute(
                    delete(AiCallPromptKnowledgeBindingModel).where(
                        AiCallPromptKnowledgeBindingModel.tenant_id == tenant_id,
                        AiCallPromptKnowledgeBindingModel.knowledge_item_id == item_id,
                    )
                )
                await db.execute(
                    delete(AiCallKnowledgeChunkModel).where(
                        AiCallKnowledgeChunkModel.tenant_id == tenant_id,
                        AiCallKnowledgeChunkModel.knowledge_version_id == version_id,
                    )
                )
                await db.execute(
                    update(AiCallKnowledgeItemModel)
                    .where(
                        AiCallKnowledgeItemModel.id == item_id,
                        AiCallKnowledgeItemModel.tenant_id == tenant_id,
                    )
                    .values(current_ready_version_id=None)
                )
                await db.execute(
                    delete(AiCallKnowledgeVersionModel).where(
                        AiCallKnowledgeVersionModel.id == version_id,
                        AiCallKnowledgeVersionModel.tenant_id == tenant_id,
                    )
                )
                await db.execute(
                    delete(AiCallKnowledgeItemModel).where(
                        AiCallKnowledgeItemModel.id == item_id,
                        AiCallKnowledgeItemModel.tenant_id == tenant_id,
                    )
                )
                await db.commit()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--filename", required=True)
    parser.add_argument("--tenant", default="000000")
    parser.add_argument("--user-id", type=int, default=1)
    args = parser.parse_args()
    asyncio.run(run(args.source, args.filename, args.tenant, args.user_id))


if __name__ == "__main__":
    main()
