"""Configuration loaded from environment variables."""

import os


class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://lecture:lecture_dev@localhost:5432/lecture_agent",
    )
    TEMPORAL_ADDRESS: str = os.getenv("TEMPORAL_ADDRESS", "localhost:7233")
    TEMPORAL_TASK_QUEUE: str = os.getenv("TEMPORAL_TASK_QUEUE", "lecture-review-queue")
    HERMES_GATEWAY_URL: str = os.getenv("HERMES_GATEWAY_URL", "http://localhost:8642")
    HERMES_API_KEY: str = os.getenv("HERMES_API_KEY", "edu-platform-test-key-2026")
    HAST_API_KEY: str = os.getenv("HAST_API_KEY", os.getenv("HERMES_API_KEY", "edu-platform-test-key-2026"))
    CORS_ALLOWED_ORIGINS: str = os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3100,http://localhost:3200,http://localhost:8233",
    )
    REVIEW_TIMEOUT_DAYS: int = int(os.getenv("REVIEW_TIMEOUT_DAYS", "7"))
    NOTIFICATION_WEBHOOK_URL: str = os.getenv("NOTIFICATION_WEBHOOK_URL", "")


settings = Settings()
