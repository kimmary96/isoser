from __future__ import annotations

from backend.rag.source_adapters.base import ApiSourceAdapter


def test_api_source_adapter_reads_alias_key_when_primary_is_missing(monkeypatch) -> None:
    adapter = ApiSourceAdapter(
        source_name="test_source",
        display_name="Test Source",
        purpose="Verify API key alias fallback.",
        key_env_name="PRIMARY_TEST_KEY",
        key_env_aliases=("별칭테스트키",),
        auth_param_name="authKey",
    )

    monkeypatch.delenv("PRIMARY_TEST_KEY", raising=False)
    monkeypatch.setenv("별칭테스트키", "alias-value")

    assert adapter.get_api_key() == "alias-value"
    assert adapter.describe_status().ready is True


def test_api_source_adapter_prefers_primary_key_over_alias(monkeypatch) -> None:
    adapter = ApiSourceAdapter(
        source_name="test_source",
        display_name="Test Source",
        purpose="Verify primary key precedence.",
        key_env_name="PRIMARY_TEST_KEY",
        key_env_aliases=("별칭테스트키",),
        auth_param_name="authKey",
    )

    monkeypatch.setenv("PRIMARY_TEST_KEY", "primary-value")
    monkeypatch.setenv("별칭테스트키", "alias-value")

    assert adapter.get_api_key() == "primary-value"
