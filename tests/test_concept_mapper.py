"""Unit tests for Concept Mapper (canonical normalization, synonym expansion, fuzzy matching)."""

import pytest
from vhagar.components.concept_mapper import ConceptMapper


@pytest.mark.asyncio
async def test_concept_mapper_add_and_expand(test_config):
    mapper = ConceptMapper(test_config)
    await mapper._load()

    # Add VAT / GST / sales tax mapping
    mapping = await mapper.add_mapping(
        canonical="VAT",
        synonyms=["Value Added Tax", "GST", "Sales Tax"],
        category="tax",
    )
    assert mapping.canonical == "VAT"
    assert "GST" in mapping.synonyms

    # Canonical resolution
    canon = await mapper.get_canonical("gst")
    assert canon == "VAT"

    canon_vat = await mapper.get_canonical("value added tax")
    assert canon_vat == "VAT"

    # Expand term
    expanded = await mapper.expand_term("GST")
    assert "VAT" in expanded
    assert "GST" in expanded
    assert "Sales Tax" in expanded


@pytest.mark.asyncio
async def test_concept_mapper_fuzzy_matching(test_config):
    mapper = ConceptMapper(test_config)
    await mapper.add_mapping(
        canonical="Reconciliation",
        synonyms=["Balance Reconciliation", "Account Matching"],
    )

    # Fuzzy match with slight typo
    canon = await mapper.get_canonical("Reconcilation")  # typo: missing 'i'
    assert canon == "Reconciliation"


@pytest.mark.asyncio
async def test_concept_mapper_remove_synonym(test_config):
    mapper = ConceptMapper(test_config)
    await mapper.add_mapping(
        canonical="Revenue",
        synonyms=["Sales", "Turnover", "Topline"],
    )

    removed = await mapper.remove_synonym("Turnover")
    assert removed is True

    canon = await mapper.get_canonical("Turnover")
    assert canon is None

