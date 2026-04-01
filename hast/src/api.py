"""
HAST API — FastAPI endpoints for the human-in-the-loop review service.

Called by:
1. Hermes agents (via review skills) to submit evaluations
2. Paperclip (optional) to check submission status
3. Human reviewers (via API for the PoC) to submit review decisions
"""

from __future__ import annotations

import asyncio
import logging
import uuid
import json
from datetime import datetime

import psycopg2
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from temporalio.client import Client as TemporalClient

from src.config import settings
from src.models import (
    SubmissionCreate,
    SubmissionResponse,
    SubmissionStatus,
    ReviewDecision,
)
from src.workflows.review_workflow import ReviewWorkflow, ReviewInput, ReviewSignal

logger = logging.getLogger(__name__)

app = FastAPI(title="HAST Review Service", version="0.10.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ALLOWED_ORIGINS.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

_temporal_client: TemporalClient | None = None


async def get_temporal_client() -> TemporalClient:
    global _temporal_client
    if _temporal_client is None:
        delays = [5, 10, 20]
        for attempt, delay in enumerate(delays, start=1):
            try:
                _temporal_client = await TemporalClient.connect(settings.TEMPORAL_ADDRESS)
                logger.info("Connected to Temporal at %s", settings.TEMPORAL_ADDRESS)
                break
            except Exception as exc:
                logger.warning(
                    "Temporal connect attempt %d failed (retrying in %ds): %s",
                    attempt, delay, exc,
                )
                await asyncio.sleep(delay)
        else:
            raise RuntimeError(
                f"Failed to connect to Temporal at {settings.TEMPORAL_ADDRESS} after {len(delays)} attempts"
            )
    return _temporal_client


def get_db():
    return psycopg2.connect(settings.DATABASE_URL)


def _row_to_response(row) -> SubmissionResponse:
    return SubmissionResponse(
        id=row[0],
        submission_type=row[1],
        entity_id=row[2],
        status=row[3],
        content=row[4],
        ai_evaluation=row[5] if isinstance(row[5], dict) else (json.loads(row[5]) if row[5] else None),
        review_decision=row[6],
        reviewer_notes=row[7],
        created_at=row[8],
        updated_at=row[9],
        workflow_id=row[10],
    )


SUBMISSION_SELECT = """SELECT id, submission_type, entity_id, status, content,
                              ai_evaluation, review_decision, reviewer_notes,
                              created_at, updated_at, workflow_id
                       FROM hast_submissions"""


async def verify_api_key(authorization: str = Header(..., description="Bearer token")) -> str:
    """Validate Bearer token against HAST_API_KEY."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    token = authorization[7:]
    if token != settings.HAST_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return token

@app.get("/health")
async def health():
    return {"status": "ok", "service": "hast-review"}


@app.post("/api/submissions", response_model=SubmissionResponse)
async def create_submission(payload: SubmissionCreate, _auth: str = Depends(verify_api_key)):
    """Create a new submission and start the review workflow."""
    submission_id = str(uuid.uuid4())
    workflow_id = f"review-{submission_id}"
    now = datetime.utcnow()

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO hast_submissions
                   (id, submission_type, entity_id, status, content, criteria,
                    ai_evaluation, paperclip_run_id, context, workflow_id,
                    created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    submission_id,
                    payload.submission_type,
                    payload.entity_id,
                    SubmissionStatus.EVALUATING.value
                    if payload.ai_evaluation is None
                    else SubmissionStatus.REVIEW.value,
                    payload.content,
                    payload.criteria,
                    json.dumps(payload.ai_evaluation) if payload.ai_evaluation else None,
                    payload.paperclip_run_id,
                    json.dumps(payload.context),
                    workflow_id,
                    now,
                    now,
                ),
            )
            conn.commit()
    finally:
        conn.close()

    # Start Temporal workflow — if this fails, clean up the DB row
    try:
        client = await get_temporal_client()
        await client.start_workflow(
            ReviewWorkflow.run,
            ReviewInput(
                submission_id=submission_id,
                submission_type=payload.submission_type,
                entity_id=payload.entity_id,
                content=payload.content,
                criteria=payload.criteria,
                ai_evaluation=payload.ai_evaluation,
            ),
            id=workflow_id,
            task_queue=settings.TEMPORAL_TASK_QUEUE,
        )
    except Exception:
        # Clean up orphaned DB row if workflow start fails
        conn = get_db()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM hast_submissions WHERE id = %s", (submission_id,))
                conn.commit()
        finally:
            conn.close()
        raise

    return SubmissionResponse(
        id=submission_id,
        submission_type=payload.submission_type,
        entity_id=payload.entity_id,
        status=SubmissionStatus.EVALUATING
        if payload.ai_evaluation is None
        else SubmissionStatus.REVIEW,
        content=payload.content,
        ai_evaluation=payload.ai_evaluation,
        review_decision=None,
        reviewer_notes=None,
        created_at=now,
        updated_at=now,
        workflow_id=workflow_id,
    )


@app.get("/api/submissions/{submission_id}", response_model=SubmissionResponse)
async def get_submission(submission_id: str, _auth: str = Depends(verify_api_key)):
    """Get a submission by ID."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"{SUBMISSION_SELECT} WHERE id = %s",
                (submission_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Submission not found")
            return _row_to_response(row)
    finally:
        conn.close()


@app.get("/api/submissions")
async def list_submissions(status: str | None = None, limit: int = 50, _auth: str = Depends(verify_api_key)):
    """List submissions, optionally filtered by status."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            if status:
                cur.execute(
                    f"{SUBMISSION_SELECT} WHERE status = %s ORDER BY created_at DESC LIMIT %s",
                    (status, limit),
                )
            else:
                cur.execute(
                    f"{SUBMISSION_SELECT} ORDER BY created_at DESC LIMIT %s",
                    (limit,),
                )
            return [_row_to_response(r) for r in cur.fetchall()]
    finally:
        conn.close()


@app.post("/api/submissions/{submission_id}/review")
async def submit_review(submission_id: str, decision: ReviewDecision, _auth: str = Depends(verify_api_key)):
    """Submit a human review decision. Sends a signal to the Temporal workflow."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT workflow_id, status FROM hast_submissions WHERE id = %s",
                (submission_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Submission not found")
            workflow_id, current_status = row
            if current_status != SubmissionStatus.REVIEW.value:
                raise HTTPException(
                    status_code=400,
                    detail=f"Submission is in '{current_status}' status, not 'review'",
                )
    finally:
        conn.close()

    client = await get_temporal_client()
    handle = client.get_workflow_handle(workflow_id)
    await handle.signal(
        ReviewWorkflow.review_decision,
        ReviewSignal(
            decision=decision.decision,
            reviewer_notes=decision.reviewer_notes,
            adjusted_score=decision.adjusted_score,
            adjusted_evaluation=decision.adjusted_evaluation,
        ),
    )

    return {"status": "review_submitted", "submission_id": submission_id}
