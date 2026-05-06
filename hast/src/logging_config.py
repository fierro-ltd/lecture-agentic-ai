"""Structured JSON logging configuration for HAST services."""

import logging
import sys

from pythonjsonlogger.json import JsonFormatter


def setup_logging(service_name: str) -> None:
    """Configure structured JSON logging for a HAST service."""
    handler = logging.StreamHandler(sys.stdout)
    formatter = JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime": "timestamp", "levelname": "level", "name": "logger"},
        static_fields={"service": service_name},
    )
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)
