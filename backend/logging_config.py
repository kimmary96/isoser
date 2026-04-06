"""Structured JSON logging helpers for backend services."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

_STANDARD_LOG_RECORD_FIELDS = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "message",
    "asctime",
}

_SILENCED_LOGGER_NAMES = (
    "chromadb.telemetry",
    "chromadb.telemetry.product",
    "chromadb.telemetry.product.posthog",
)

_SILENCED_LOGGER_PREFIXES = (
    "chromadb.telemetry",
)


class JSONFormatter(logging.Formatter):
    """Render log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(
                record.created,
                tz=timezone.utc,
            ).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "event": getattr(record, "event", record.getMessage()),
        }

        for key, value in record.__dict__.items():
            if key in _STANDARD_LOG_RECORD_FIELDS or key.startswith("_"):
                continue
            payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False, default=str)


class LoggerPrefixDropFilter(logging.Filter):
    """Drop records from known noisy logger namespaces."""

    def __init__(self, blocked_prefixes: tuple[str, ...]) -> None:
        super().__init__()
        self._blocked_prefixes = blocked_prefixes

    def filter(self, record: logging.LogRecord) -> bool:
        return not any(
            record.name == prefix or record.name.startswith(f"{prefix}.")
            for prefix in self._blocked_prefixes
        )


def _silence_noisy_loggers() -> None:
    """Disable third-party loggers that only emit non-actionable telemetry noise."""

    for logger_name in _SILENCED_LOGGER_NAMES:
        noisy_logger = logging.getLogger(logger_name)
        noisy_logger.handlers.clear()
        noisy_logger.propagate = False
        noisy_logger.disabled = True


def configure_logging(level: str | None = None) -> None:
    """Configure the root logger once with JSON formatting."""

    if getattr(configure_logging, "_configured", False):
        return

    resolved_level = (level or os.getenv("LOG_LEVEL") or "INFO").upper()
    root_logger = logging.getLogger()
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    handler.addFilter(LoggerPrefixDropFilter(_SILENCED_LOGGER_PREFIXES))

    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(getattr(logging, resolved_level, logging.INFO))
    _silence_noisy_loggers()

    configure_logging._configured = True


def get_logger(name: str) -> logging.Logger:
    """Return a configured logger instance."""

    configure_logging()
    return logging.getLogger(name)


def log_event(
    logger: logging.Logger,
    level: int,
    event: str,
    **fields: Any,
) -> None:
    """Emit a structured log event with additional JSON fields."""

    logger.log(level, event, extra={"event": event, **fields})


__all__ = [
    "JSONFormatter",
    "configure_logging",
    "get_logger",
    "log_event",
]
