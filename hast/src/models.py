"""Pydantic models for the review workflow."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class SubmissionStatus(str, Enum):
    PENDING = "pending"
    EVALUATING = "evaluating"
    REVIEW = "review"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVISION_REQUESTED = "revision_requested"
    EXPIRED = "expired"


class SubmissionCreate(BaseModel):
    """Payload from a Hermes agent submitting content for review."""

    submission_type: str = Field(
        ...,
        description="Type of submission (e.g. assessment, clinical_review, compliance, inspection)",
    )
    entity_id: str = Field(..., description="Entity identifier (e.g. student, patient, applicant, case number)")
    context: dict[str, Any] = Field(
        default_factory=dict,
        description="Contextual metadata (e.g. course_id, department_id, case_number)",
    )
    content: str = Field(..., description="The content being evaluated")
    criteria: str = Field(
        default="",
        description="Evaluation criteria / rubric",
    )
    ai_evaluation: dict[str, Any] | None = Field(
        default=None,
        description="Pre-computed AI evaluation from the Hermes agent",
    )
    paperclip_run_id: str | None = Field(
        default=None,
        description="Paperclip run ID for traceability",
    )


class ReviewDecision(BaseModel):
    """Human reviewer's decision."""

    decision: str = Field(
        ...,
        description="approved | rejected | revision_requested",
    )
    reviewer_notes: str = Field(default="")
    adjusted_score: float | None = None
    adjusted_evaluation: dict[str, Any] | None = None


class SubmissionResponse(BaseModel):
    """API response for a submission."""

    id: str
    submission_type: str
    entity_id: str
    status: SubmissionStatus
    content: str
    ai_evaluation: dict[str, Any] | None
    review_decision: str | None
    reviewer_notes: str | None
    created_at: datetime
    updated_at: datetime
    workflow_id: str | None
