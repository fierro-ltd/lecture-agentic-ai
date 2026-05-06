"""Tests for HAST Pydantic models."""

from src.models import SubmissionCreate, ReviewDecision, SubmissionResponse, SubmissionStatus
from datetime import datetime


def test_submission_create_minimal():
    s = SubmissionCreate(
        submission_type="assessment",
        entity_id="student-123",
        content="My essay about AI in education.",
    )
    assert s.submission_type == "assessment"
    assert s.entity_id == "student-123"
    assert s.ai_evaluation is None
    assert s.context == {}


def test_submission_create_with_evaluation():
    s = SubmissionCreate(
        submission_type="enrollment",
        entity_id="applicant-456",
        content="Application materials",
        criteria="GPA >= 3.0",
        ai_evaluation={"overall_score": 85, "strengths": ["strong GPA"]},
    )
    assert s.ai_evaluation["overall_score"] == 85


def test_review_decision():
    d = ReviewDecision(decision="approved", reviewer_notes="Excellent work")
    assert d.decision == "approved"
    assert d.adjusted_score is None


def test_submission_response():
    now = datetime.utcnow()
    r = SubmissionResponse(
        id="uuid-1",
        submission_type="assessment",
        entity_id="student-1",
        status=SubmissionStatus.REVIEW,
        content="test",
        ai_evaluation=None,
        review_decision=None,
        reviewer_notes=None,
        created_at=now,
        updated_at=now,
        workflow_id="review-uuid-1",
    )
    assert r.status == SubmissionStatus.REVIEW
