"""Component bootstrapping and registry for Vhagar."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Optional

import structlog

from vhagar.config import get_config, set_config, VhagarConfig

logger = structlog.get_logger(__name__)

_registry: Optional["ComponentRegistry"] = None


@dataclass
class ComponentRegistry:
    """Holds references to all initialized backend components."""

    config: VhagarConfig
    document_processor: Optional["DocumentProcessor"] = None
    hybrid_index: Optional["HybridIndex"] = None
    concept_mapper: Optional["ConceptMapper"] = None
    concept_memory: Optional["ConceptMemory"] = None
    excel_processor: Optional["ExcelProcessor"] = None
    query_engine: Optional["QueryEngine"] = None
    observability: Optional["ObservabilityManager"] = None
    security: Optional["SecurityManager"] = None
    _initialized: bool = field(default=False, repr=False)


async def bootstrap(config: VhagarConfig | None = None) -> ComponentRegistry:
    """Initialize all components and return the registry."""
    global _registry

    if _registry is not None and _registry._initialized:
        return _registry

    cfg = config or get_config()
    set_config(cfg)
    registry = ComponentRegistry(config=cfg)

    try:
        from vhagar.components.observability import ObservabilityManager

        registry.observability = ObservabilityManager(cfg)
        logger.info("component_initialized", component="observability")
    except Exception as exc:
        logger.error("component_init_failed", component="observability", error=str(exc))

    try:
        from vhagar.components.security import SecurityManager

        registry.security = SecurityManager(cfg)
        logger.info("component_initialized", component="security")
    except Exception as exc:
        logger.error("component_init_failed", component="security", error=str(exc))

    try:
        from vhagar.components.concept_mapper import ConceptMapper

        registry.concept_mapper = ConceptMapper(cfg)
        await registry.concept_mapper._load()
        logger.info("component_initialized", component="concept_mapper")
    except Exception as exc:
        logger.error("component_init_failed", component="concept_mapper", error=str(exc))

    try:
        from vhagar.components.concept_memory import ConceptMemory

        registry.concept_memory = ConceptMemory(cfg)
        await registry.concept_memory._load()
        logger.info("component_initialized", component="concept_memory")
    except Exception as exc:
        logger.error("component_init_failed", component="concept_memory", error=str(exc))

    try:
        from vhagar.components.excel_processor import ExcelProcessor

        registry.excel_processor = ExcelProcessor(cfg)
        logger.info("component_initialized", component="excel_processor")
    except Exception as exc:
        logger.error("component_init_failed", component="excel_processor", error=str(exc))

    try:
        from vhagar.components.document_processor import DocumentProcessor

        registry.document_processor = DocumentProcessor(cfg)
        logger.info("component_initialized", component="document_processor")
    except Exception as exc:
        logger.error("component_init_failed", component="document_processor", error=str(exc))

    try:
        from vhagar.components.hybrid_index import HybridIndex

        registry.hybrid_index = HybridIndex(cfg)
        logger.info("component_initialized", component="hybrid_index")
    except Exception as exc:
        logger.error("component_init_failed", component="hybrid_index", error=str(exc))

    try:
        from vhagar.components.query_engine import QueryEngine

        if registry.hybrid_index and registry.concept_mapper and registry.concept_memory:
            registry.query_engine = QueryEngine(
                index=registry.hybrid_index,
                concept_mapper=registry.concept_mapper,
                concept_memory=registry.concept_memory,
                config=cfg,
            )
            logger.info("component_initialized", component="query_engine")
        else:
            logger.warning("query_engine_skipped", reason="missing dependencies")
    except Exception as exc:
        logger.error("component_init_failed", component="query_engine", error=str(exc))

    registry._initialized = True
    _registry = registry
    logger.info("bootstrap_complete", components_ready=sum(1 for f in [
        registry.document_processor, registry.hybrid_index, registry.concept_mapper,
        registry.concept_memory, registry.excel_processor, registry.query_engine,
        registry.observability, registry.security,
    ] if f is not None))

    return registry


def get_registry() -> ComponentRegistry:
    """Return the initialized component registry, bootstrapping synchronously if needed."""
    global _registry
    if _registry is None or not _registry._initialized:
        cfg = get_config()
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # In running loop, initialize synchronously
                reg = ComponentRegistry(config=cfg)
                from vhagar.components.observability import ObservabilityManager
                from vhagar.components.security import SecurityManager
                from vhagar.components.concept_mapper import ConceptMapper
                from vhagar.components.concept_memory import ConceptMemory
                from vhagar.components.excel_processor import ExcelProcessor
                from vhagar.components.document_processor import DocumentProcessor
                from vhagar.components.hybrid_index import HybridIndex
                from vhagar.components.query_engine import QueryEngine

                reg.observability = ObservabilityManager(cfg)
                reg.security = SecurityManager(cfg)
                reg.concept_mapper = ConceptMapper(cfg)
                reg.concept_memory = ConceptMemory(cfg)
                reg.excel_processor = ExcelProcessor(cfg)
                reg.document_processor = DocumentProcessor(cfg)
                reg.hybrid_index = HybridIndex(cfg)
                reg.query_engine = QueryEngine(
                    index=reg.hybrid_index,
                    concept_mapper=reg.concept_mapper,
                    concept_memory=reg.concept_memory,
                    config=cfg,
                )
                reg._initialized = True
                _registry = reg
                return _registry
            else:
                return loop.run_until_complete(bootstrap(cfg))
        except Exception as exc:
            logger.warning("sync_bootstrap_fallback", error=str(exc))
            reg = ComponentRegistry(config=cfg)
            from vhagar.components.observability import ObservabilityManager
            from vhagar.components.security import SecurityManager
            from vhagar.components.excel_processor import ExcelProcessor
            from vhagar.components.document_processor import DocumentProcessor
            reg.observability = ObservabilityManager(cfg)
            reg.security = SecurityManager(cfg)
            reg.excel_processor = ExcelProcessor(cfg)
            reg.document_processor = DocumentProcessor(cfg)
            reg._initialized = True
            _registry = reg
            return _registry

    return _registry

