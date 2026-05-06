"""Webhook notification activity for review events."""

from __future__ import annotations

import logging

import httpx
from temporalio import activity

from src.config import settings

logger = logging.getLogger(__name__)


@activity.defn
async def send_notification(payload: dict) -> bool:
    """POST a JSON payload to the configured webhook URL. No-op if URL is not set."""
    url = settings.NOTIFICATION_WEBHOOK_URL
    if not url:
        logger.debug("No NOTIFICATION_WEBHOOK_URL configured, skipping notification")
        return False

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
        logger.info("Notification sent: event=%s submission=%s", payload.get("event"), payload.get("submission_id"))
        return True
    except Exception as e:
        logger.warning("Notification webhook failed: %s", e)
        return False
