"""
Temporal activity implementations.

These are the actual side-effect-producing functions called by the workflow.
They interact with the database and the Hermes gateway.
"""

from __future__ import annotations

import json

import httpx
import psycopg2
from temporalio import activity

from src.config import settings


@activity.defn
async def evaluate_submission(input) -> dict:
    """
    Call the Hermes gateway (OpenAI-compatible API) to evaluate a submission.
    Used when the Hermes agent hasn't already produced an evaluation.
    """
    activity.heartbeat("Starting AI evaluation")

    system_prompt = f"""You are an academic assessment evaluator. Evaluate the following
submission against the provided criteria. Respond with ONLY valid JSON matching this schema:
{{
  "overall_score": <0-100>,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "feedback": "...",
  "reasoning": "..."
}}

Criteria: {input.criteria}"""

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{settings.HERMES_GATEWAY_URL}/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.HERMES_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "default",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": input.content},
                ],
                "temperature": 0.3,
            },
        )
        response.raise_for_status()
        data = response.json()

    content = data["choices"][0]["message"]["content"]

    # Parse the JSON response, handling potential markdown fencing
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0]

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {"overall_score": 0, "feedback": content, "error": "Failed to parse structured response"}


@activity.defn
async def update_submission_status(params: dict) -> None:
    """Update the submission status in PostgreSQL."""
    conn = psycopg2.connect(settings.DATABASE_URL)
    try:
        with conn.cursor() as cur:
            updates = ["status = %s", "updated_at = NOW()"]
            values = [params["status"]]

            if "ai_evaluation" in params and params["ai_evaluation"]:
                updates.append("ai_evaluation = %s")
                values.append(json.dumps(params["ai_evaluation"]))

            values.append(params["submission_id"])
            cur.execute(
                f"UPDATE hast_submissions SET {', '.join(updates)} WHERE id = %s",
                values,
            )
            conn.commit()
    finally:
        conn.close()


@activity.defn
async def record_review_decision(params: dict) -> None:
    """Record the final review decision."""
    conn = psycopg2.connect(settings.DATABASE_URL)
    try:
        status_map = {
            "approved": "approved",
            "rejected": "rejected",
            "revision_requested": "revision_requested",
        }
        status = status_map.get(params["decision"], params["decision"])

        with conn.cursor() as cur:
            cur.execute(
                """UPDATE hast_submissions
                   SET status = %s,
                       review_decision = %s,
                       reviewer_notes = %s,
                       adjusted_score = %s,
                       updated_at = NOW()
                   WHERE id = %s""",
                (
                    status,
                    params["decision"],
                    params.get("reviewer_notes", ""),
                    params.get("adjusted_score"),
                    params["submission_id"],
                ),
            )
            conn.commit()
    finally:
        conn.close()
