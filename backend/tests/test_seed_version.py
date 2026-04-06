from __future__ import annotations

import json
from pathlib import Path
import tempfile

from backend.rag.seed_version import load_manifest, rollback_seeds, upgrade_seeds


class FakeCollection:
    def __init__(self) -> None:
        self.documents: list[str] = []
        self.ids: list[str] = []

    def count(self) -> int:
        return len(self.documents)

    def add(self, *, documents, metadatas, ids) -> None:
        self.documents.extend(documents)
        self.ids.extend(ids)


class FakeClient:
    def __init__(self) -> None:
        self.collections = {
            "job_keyword_patterns": FakeCollection(),
            "star_examples": FakeCollection(),
            "job_posting_snippets": FakeCollection(),
        }

    def delete_collection(self, name: str) -> None:
        self.collections[name] = FakeCollection()


def _write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _seed_payload(version: str, document: str) -> list[dict]:
    return [
        {
            "id": f"se:{version}:001",
            "activity_type": "star_gap",
            "section_type": "회사경력",
            "job_family": "pm",
            "original_text": "온보딩 경험을 개선했습니다.",
            "missing_before": ["Situation", "Result"],
            "rewrite_focus": "STAR 구조 보강",
            "lang": "ko",
            "version": version,
            "is_active": True,
            "document": document,
        }
    ]


def test_upgrade_and_rollback_seeds(monkeypatch) -> None:
    with tempfile.TemporaryDirectory(dir=".") as tmp_dir:
        tmp_path = Path(tmp_dir)
        seed_dir = tmp_path / "seed_data"
        seed_dir.mkdir()
        manifest_path = seed_dir / "manifest.json"
        active_seed_path = seed_dir / "star_examples.json"
        candidate_seed_path = tmp_path / "star_examples_v2_candidate.json"

        _write_json(active_seed_path, _seed_payload("v1", "기존 v1 문장입니다."))
        _write_json(candidate_seed_path, _seed_payload("v2", "새로운 v2 문장입니다."))
        _write_json(seed_dir / "job_keyword_patterns.json", [])
        _write_json(seed_dir / "job_posting_snippets.json", [])

        fake_client = FakeClient()

        def fake_get_or_create_collections(client: FakeClient):
            return (
                client.collections["job_keyword_patterns"],
                client.collections["star_examples"],
                client.collections["job_posting_snippets"],
            )

        monkeypatch.setattr("backend.rag.seed_version.create_chroma_client", lambda: (fake_client, "ephemeral"))
        monkeypatch.setattr("backend.rag.seed_version.get_or_create_collections", fake_get_or_create_collections)

        manifest = load_manifest(manifest_path=manifest_path, seed_dir=seed_dir)
        assert manifest["collections"]["star_examples"]["active_version"] == "v1"

        upgrade_result = upgrade_seeds(
            "star_examples",
            candidate_seed_path,
            manifest_path=manifest_path,
            seed_dir=seed_dir,
            client=fake_client,
        )

        assert upgrade_result["active_version"] == "v2"
        upgraded_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        assert upgraded_manifest["collections"]["star_examples"]["active_version"] == "v2"
        assert fake_client.collections["star_examples"].count() == 1
        assert "새로운 v2 문장입니다." in active_seed_path.read_text(encoding="utf-8")

        rollback_result = rollback_seeds(
            "star_examples",
            version="v1",
            manifest_path=manifest_path,
            seed_dir=seed_dir,
            client=fake_client,
        )

        assert rollback_result["active_version"] == "v1"
        rolled_back_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        assert rolled_back_manifest["collections"]["star_examples"]["active_version"] == "v1"
        assert "기존 v1 문장입니다." in active_seed_path.read_text(encoding="utf-8")
