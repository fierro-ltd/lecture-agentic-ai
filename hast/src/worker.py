"""Temporal worker process — runs workflow and activity executors."""

import asyncio
from temporalio.client import Client
from temporalio.worker import Worker

from src.config import settings
from src.workflows.review_workflow import ReviewWorkflow
from src.workflows.activities import (
    evaluate_submission,
    update_submission_status,
    record_review_decision,
)


async def main():
    client = await Client.connect(settings.TEMPORAL_ADDRESS)

    worker = Worker(
        client,
        task_queue=settings.TEMPORAL_TASK_QUEUE,
        workflows=[ReviewWorkflow],
        activities=[
            evaluate_submission,
            update_submission_status,
            record_review_decision,
        ],
    )

    print(f"HAST Worker started on queue: {settings.TEMPORAL_TASK_QUEUE}")
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
