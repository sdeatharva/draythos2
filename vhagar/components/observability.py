"""Observability – structured logging, Prometheus metrics, correlation IDs."""

from __future__ import annotations

import uuid
import time
import os

import structlog
from prometheus_client import Counter, Histogram, Gauge

logger = structlog.get_logger(__name__)

# --- Prometheus metrics ---

upload_total = Counter("vhagar_upload_total", "Total uploads", ["format", "status"])
upload_duration = Histogram("vhagar_upload_duration_seconds", "Upload processing duration", ["format"])
query_total = Counter("vhagar_query_total", "Total queries", ["status"])
query_duration = Histogram("vhagar_query_duration_seconds", "Query latency")
indexing_total = Counter("vhagar_indexing_total", "Total indexing operations", ["format"])
indexing_duration = Histogram("vhagar_indexing_duration_seconds", "Indexing duration", ["format"])
ocr_duration = Histogram("vhagar_ocr_duration_seconds", "OCR processing duration", ["pages"])
ocr_cache_hits = Counter("vhagar_ocr_cache_hits_total", "OCR cache hits")
documents_indexed = Gauge("vhagar_documents_indexed", "Currently indexed documents", ["format"])
mapping_updates = Counter("vhagar_mapping_updates_total", "Concept mapping updates", ["action"])
provider_calls = Counter("vhagar_provider_calls_total", "Provider API calls", ["provider", "status"])
provider_latency = Histogram("vhagar_provider_latency_seconds", "Provider call latency", ["provider"])
save_operations = Counter("vhagar_save_operations_total", "Save operations", ["format", "status"])
active_processing_jobs = Gauge("vhagar_active_processing_jobs", "Active processing jobs")
system_memory = Gauge("vhagar_system_memory_bytes", "System memory usage")


class ObservabilityManager:
    """Central observability manager for metrics, logging, and correlation."""

    def __init__(self, config):
        self.config = config
        # Configure structlog
        structlog.configure(
            processors=[
                structlog.contextvars.merge_contextvars,
                structlog.processors.add_log_level,
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.dev.ConsoleRenderer(),
            ],
            wrapper_class=structlog.make_filtering_bound_logger(20),  # INFO
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(),
            cache_logger_on_first_use=True,
        )

    def generate_correlation_id(self) -> str:
        """Generate a unique correlation ID for request tracing."""
        return str(uuid.uuid4())

    def log_request(
        self,
        correlation_id: str,
        stage: str,
        duration: float,
        result: str,
        error_category: str | None = None,
    ):
        """Log a structured request event. Never log raw text, secrets, or full prompts."""
        log_data = {
            "correlation_id": correlation_id,
            "stage": stage,
            "duration_ms": round(duration * 1000, 2),
            "result": result,
        }
        if error_category:
            log_data["error_category"] = error_category

        if result == "error":
            logger.error("request_event", **log_data)
        else:
            logger.info("request_event", **log_data)

    def record_upload(self, format: str, status: str, duration: float):
        upload_total.labels(format=format, status=status).inc()
        upload_duration.labels(format=format).observe(duration)

    def record_query(self, status: str, duration: float):
        query_total.labels(status=status).inc()
        query_duration.observe(duration)

    def record_ocr(self, pages: int, duration: float, cache_hit: bool):
        ocr_duration.labels(pages=str(pages)).observe(duration)
        if cache_hit:
            ocr_cache_hits.inc()

    def record_provider_call(self, provider: str, status: str, latency: float):
        provider_calls.labels(provider=provider, status=status).inc()
        provider_latency.labels(provider=provider).observe(latency)

    def record_save(self, format: str, status: str):
        save_operations.labels(format=format, status=status).inc()

    def get_metrics(self) -> str:
        """Return Prometheus text format metrics."""
        from prometheus_client import generate_latest
        return generate_latest().decode("utf-8")

    def get_health(self) -> dict:
        """Return a health summary."""
        try:
            import psutil
            mem = psutil.virtual_memory()
            system_memory.set(mem.used)
            mem_info = {"used_mb": mem.used // (1024 * 1024), "percent": mem.percent}
        except ImportError:
            mem_info = {"note": "psutil not installed"}

        return {
            "status": "healthy",
            "memory": mem_info,
            "pid": os.getpid(),
        }

