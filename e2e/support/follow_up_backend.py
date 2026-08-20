from __future__ import annotations

import os
import re
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.api.v1.ai_call import AiCallRouter
from app.api.v1.ai_call.model import AiCallFollowUpDataModel, AiCallRecordModel
from app.api.v1.ai_call.outbound.rule_task_model import (
    AiCallOutboundAttemptModel,
    AiCallOutboundTargetModel,
    AiCallOutboundTaskModel,
)
from app.api.v1.system.user.model import UserModel
from app.core.database import async_db_session, async_engine, create_tables


async def seed() -> None:
    await create_tables()
    async with async_db_session() as db, db.begin():
        if await db.scalar(select(UserModel.user_id).limit(1)):
            return

        now = datetime(2026, 8, 15, 10, 0, tzinfo=timezone.utc)
        db.add_all(
            [
                UserModel(
                    user_id=1,
                    tenant_id="tenant-a",
                    user_name="e2e-admin",
                    nick_name="测试管理员",
                    user_type="admin",
                ),
                AiCallOutboundTaskModel(
                    id=200,
                    tenant_id="tenant-a",
                    validation_id=1,
                    idempotency_key="e2e-task-200",
                    request_fingerprint="e2e-task-fingerprint-200",
                    task_name="SaaS 产品回访",
                    task_mode="batch",
                    status="COMPLETED",
                    total_targets=1,
                    completed_targets=1,
                    connected_targets=1,
                    failed_targets=0,
                    execution_mode="immediate",
                    prompt_name="产品介绍",
                    scene_code="intro_product",
                    voice="Cherry",
                    rule_id=1,
                    rule_name="工作日",
                    rule_summary="09:00-18:00",
                    config_snapshot_json="{}",
                    created_by=1,
                    created_at=now,
                    updated_at=now,
                ),
                AiCallOutboundTargetModel(
                    id=300,
                    tenant_id="tenant-a",
                    task_id=200,
                    validation_id=1,
                    source_validation_row_id=300,
                    source_row_number=1,
                    phone_number="13800001001",
                    customer_name="科技公司",
                    status="COMPLETED",
                    attempt_count=1,
                    latest_result="connected",
                    created_at=now,
                    updated_at=now,
                ),
                AiCallFollowUpDataModel(
                    id=100,
                    tenant_id="tenant-a",
                    task_id=200,
                    target_id=300,
                    source_call_id="call-source-1",
                    classification="interested",
                    classification_reason="客户明确希望了解产品演示。",
                    classification_source="ai",
                    classification_confidence="high",
                    suggest_review=False,
                    latest_conclusion="客户希望下周查看产品演示。",
                    last_contact_at=now,
                    blocking_human_call_id=None,
                    version=1,
                    classification_updated_at=now,
                    classification_updated_by="ai",
                    created_at=now,
                    updated_at=now,
                ),
                AiCallRecordModel(
                    id=101,
                    tenant_id="tenant-a",
                    call_id="call-source-1",
                    follow_up_data_id=100,
                    business_type="outbound_task",
                    business_id="200",
                    scene_code="intro_product",
                    entry_type="sip_outbound",
                    room_name="room-call-source-1",
                    participant_identity="customer-300",
                    callee_phone_number_masked="138****1001",
                    status="completed",
                    started_at=now - timedelta(minutes=3),
                    ended_at=now,
                    duration_ms=180000,
                ),
                AiCallOutboundAttemptModel(
                    id=103,
                    tenant_id="tenant-a",
                    task_id=200,
                    target_id=300,
                    attempt_no=1,
                    call_id="call-source-1",
                    dialer_type="sip",
                    command_idempotency_key="e2e-command-call-source-1",
                    status="COMPLETED",
                    call_result="connected",
                    started_at=now,
                    ended_at=now,
                    created_at=now,
                    updated_at=now,
                ),
            ]
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    await seed()
    yield
    await async_engine.dispose()


app = FastAPI(lifespan=lifespan)
app.include_router(AiCallRouter)

_CALL_PATH = re.compile(
    r"/(?:sessions|sip-sessions|runtime/start-call|follow-ups/\d+/call|follow-up-data/\d+/call)$"
)


@app.middleware("http")
async def block_calls(request: Request, call_next):
    if request.method == "POST" and _CALL_PATH.search(request.url.path):
        return JSONResponse(
            status_code=503,
            content={"code": 500, "msg": "全链路测试禁止发起真实呼叫"},
        )
    return await call_next(request)


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ["AI_CALL_E2E_PORT"]))
