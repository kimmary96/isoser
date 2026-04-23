from __future__ import annotations

import backend.main as backend_main


def test_chroma_seed_on_startup_defaults_off_for_ephemeral(monkeypatch):
    monkeypatch.delenv("ISOSER_CHROMA_SEED_ON_STARTUP", raising=False)
    monkeypatch.setenv("CHROMA_MODE", "ephemeral")

    assert backend_main._should_seed_chroma_on_startup() is False


def test_chroma_seed_on_startup_defaults_on_for_persistent(monkeypatch):
    monkeypatch.delenv("ISOSER_CHROMA_SEED_ON_STARTUP", raising=False)
    monkeypatch.setenv("CHROMA_MODE", "persistent")

    assert backend_main._should_seed_chroma_on_startup() is True


def test_chroma_seed_on_startup_env_override(monkeypatch):
    monkeypatch.setenv("CHROMA_MODE", "ephemeral")
    monkeypatch.setenv("ISOSER_CHROMA_SEED_ON_STARTUP", "true")

    assert backend_main._should_seed_chroma_on_startup() is True
