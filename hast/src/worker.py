"""Temporal worker process — runs workflow and activity executors."""

import asyncio
import logging
from temporalio.client import Client
from temporalio.worker import Worker

from src.config import settings
from src.logging_config import setup_logging
from src.workflows.review_workflow import ReviewWorkflow
from src.workflows.activities import (
    evaluate_submission,
    update_submission_status,
    record_review_decision,
)
from src.workflows.notifications import send_notification

setup_logging("hast-worker")
logger = logging.getLogger(__name__)


async def main():
    delays = [5, 10, 20]
    client = None
    for attempt, delay in enumerate(delays, start=1):
        try:
            client = await Client.connect(settings.TEMPORAL_ADDRESS)
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

    worker = Worker(
        client,
        task_queue=settings.TEMPORAL_TASK_QUEUE,
        workflows=[ReviewWorkflow],
        activities=[
            evaluate_submission,
            update_submission_status,
            record_review_decision,
            send_notification,
        ],
    )

    logger.info("HAST Worker started on queue: %s", settings.TEMPORAL_TASK_QUEUE)
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
