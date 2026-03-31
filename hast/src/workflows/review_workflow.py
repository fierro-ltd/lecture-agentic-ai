"""
Temporal workflow for human-in-the-loop review.

This is the core HAST pattern: AI evaluates -> human reviews -> decision recorded.
The workflow is durable — survives crashes, respects timeouts, supports signals.
"""

from __future__ import annotations

from datetime import timedelta
from dataclasses import dataclass

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from src.config import settings


@dataclass
class ReviewInput:
    submission_id: str
    submission_type: str
    entity_id: str
    content: str
    criteria: str
    ai_evaluation: dict | None = None


@dataclass
class ReviewSignal:
    decision: str  # approved | rejected | revision_requested
    reviewer_notes: str = ""
    adjusted_score: float | None = None
    adjusted_evaluation: dict | None = None


@workflow.defn
class ReviewWorkflow:
    """
    Durable human-in-the-loop review workflow.

    Flow:
    1. If no AI evaluation provided, run AI evaluation activity
    2. Notify reviewer (update status to 'review')
    3. Wait for human signal (up to REVIEW_TIMEOUT_DAYS)
    4. Record final decision
    """

    def __init__(self) -> None:
        self._review_signal: ReviewSignal | None = None

    @workflow.signal
    async def review_decision(self, signal: ReviewSignal) -> None:
        self._review_signal = signal

    @workflow.query
    def get_status(self) -> str:
        if self._review_signal:
            return self._review_signal.decision
        return "waiting_for_review"

    @workflow.run
    async def run(self, input: ReviewInput) -> dict:
        # Step 1: AI evaluation (if not already done by the Hermes agent)
        ai_eval = input.ai_evaluation
        if ai_eval is None:
            ai_eval = await workflow.execute_activity(
                "evaluate_submission",
                input,
                start_to_close_timeout=timedelta(minutes=10),
                retry_policy=RetryPolicy(maximum_attempts=3),
                heartbeat_timeout=timedelta(seconds=30),
            )

        # Step 2: Mark as ready for review
        await workflow.execute_activity(
            "update_submission_status",
            {"submission_id": input.submission_id, "status": "review", "ai_evaluation": ai_eval},
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Step 3: Wait for human review signal
        timeout = timedelta(days=settings.REVIEW_TIMEOUT_DAYS)
        try:
            await workflow.wait_condition(
                lambda: self._review_signal is not None,
                timeout=timeout,
            )
        except TimeoutError:
            await workflow.execute_activity(
                "update_submission_status",
                {"submission_id": input.submission_id, "status": "expired"},
                start_to_close_timeout=timedelta(seconds=30),
            )
            return {"status": "expired", "submission_id": input.submission_id}

        # Step 4: Record decision
        signal = self._review_signal
        await workflow.execute_activity(
            "record_review_decision",
            {
                "submission_id": input.submission_id,
                "decision": signal.decision,
                "reviewer_notes": signal.reviewer_notes,
                "adjusted_score": signal.adjusted_score,
                "adjusted_evaluation": signal.adjusted_evaluation,
            },
            start_to_close_timeout=timedelta(seconds=30),
        )

        return {
            "status": signal.decision,
            "submission_id": input.submission_id,
            "reviewer_notes": signal.reviewer_notes,
        }
