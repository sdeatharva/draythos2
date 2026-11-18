"""Vhagar API routers package."""

from vhagar.api.facts import router as facts_router
from vhagar.api.concepts import router as concepts_router
from vhagar.api.mappings import router as mappings_router
from vhagar.api.normalize import router as normalize_router
from vhagar.api.export import router as export_router
from vhagar.api.qa import router as qa_router

__all__ = [
    "facts_router",
    "concepts_router",
    "mappings_router",
    "normalize_router",
    "export_router",
    "qa_router",
]

