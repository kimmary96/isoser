"""Seed manifest management with upgrade and rollback helpers."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import shutil
from pathlib import Path
from typing import Any

import chromadb
from pydantic import ValidationError

from backend.rag.chroma_client import create_chroma_client, get_or_create_collections
from backend.rag.schema import JobKeywordPatternSeed, JobPostingSnippetSeed, StarExampleSeed
from backend.rag.seed import seed_job_keywords, seed_job_posting_snippets, seed_star_examples

SEED_DIR = Path(__file__).resolve().parent / "seed_data"
MANIFEST_PATH = SEED_DIR / "manifest.json"
COLLECTION_CONFIG = {
    "job_keyword_patterns": {
        "filename": "job_keyword_patterns.json",
        "model": JobKeywordPatternSeed,
        "seed_fn": seed_job_keywords,
        "collection_index": 0,
    },
    "star_examples": {
        "filename": "star_examples.json",
        "model": StarExampleSeed,
        "seed_fn": seed_star_examples,
        "collection_index": 1,
    },
    "job_posting_snippets": {
        "filename": "job_posting_snippets.json",
        "model": JobPostingSnippetSeed,
        "seed_fn": seed_job_posting_snippets,
        "collection_index": 2,
    },
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _safe_text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _snapshot_file_path(collection_name: str, version: str, *, seed_dir: Path = SEED_DIR) -> Path:
    return seed_dir / "_versions" / collection_name / f"{version}.json"


def _read_validated_items(collection_name: str, path: Path) -> list[Any]:
    config = COLLECTION_CONFIG[collection_name]
    model_cls = config["model"]
    payload = _load_json(path)
    if not isinstance(payload, list):
        raise ValueError(f"Seed file must contain a JSON array: {path}")

    seen_documents: set[str] = set()
    validated_items: list[Any] = []
    for index, item in enumerate(payload):
        if not isinstance(item, dict):
            raise ValueError(f"{collection_name}: item index={index} must be a JSON object")
        try:
            validated = model_cls(**item)
        except ValidationError as exc:
            raise ValueError(f"{collection_name}: invalid item index={index} - {exc}") from exc
        if validated.document in seen_documents:
            raise ValueError(f"{collection_name}: duplicate document found at index={index}")
        seen_documents.add(validated.document)
        validated_items.append(validated)
    return validated_items


def _bootstrap_entry(collection_name: str, *, seed_dir: Path = SEED_DIR) -> dict[str, Any]:
    filename = COLLECTION_CONFIG[collection_name]["filename"]
    path = seed_dir / filename
    items = _read_validated_items(collection_name, path)
    version = items[0].version if items else "unknown"
    return {
        "active_version": version,
        "count": len(items),
        "source_files": [filename],
        "active_file": filename,
        "history": [],
    }


def load_manifest(*, manifest_path: Path = MANIFEST_PATH, seed_dir: Path = SEED_DIR) -> dict[str, Any]:
    if manifest_path.exists():
        payload = _load_json(manifest_path)
        if isinstance(payload, dict):
            return payload

    manifest = {
        "updated_at": _utc_now(),
        "collections": {
            collection_name: _bootstrap_entry(collection_name, seed_dir=seed_dir)
            for collection_name in COLLECTION_CONFIG
        },
    }
    save_manifest(manifest, manifest_path=manifest_path)
    return manifest


def save_manifest(manifest: dict[str, Any], *, manifest_path: Path = MANIFEST_PATH) -> Path:
    manifest["updated_at"] = _utc_now()
    _write_json(manifest_path, manifest)
    return manifest_path


def _ensure_snapshot(
    collection_name: str,
    *,
    version: str,
    source_path: Path,
    seed_dir: Path = SEED_DIR,
) -> Path:
    snapshot_path = _snapshot_file_path(collection_name, version, seed_dir=seed_dir)
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    if not snapshot_path.exists():
        shutil.copy2(source_path, snapshot_path)
    return snapshot_path


def _reseed_collection(
    collection_name: str,
    items: list[Any],
    *,
    client: chromadb.ClientAPI | None = None,
) -> int:
    local_client = client
    if local_client is None:
        local_client, _ = create_chroma_client()

    try:
        local_client.delete_collection(collection_name)
    except Exception:
        pass

    collections = get_or_create_collections(local_client)
    config = COLLECTION_CONFIG[collection_name]
    collection = collections[config["collection_index"]]
    config["seed_fn"](collection, items=items, total_count=len(items))
    count = collection.count()
    if count != len(items):
        raise RuntimeError(
            f"{collection_name}: reseed verification failed - expected {len(items)}, got {count}"
        )
    return count


def _upsert_history_entry(entry: dict[str, Any], history_item: dict[str, Any]) -> None:
    history = entry.setdefault("history", [])
    for existing in history:
        if existing.get("version") == history_item["version"]:
            existing.update(history_item)
            return
    history.append(history_item)


def upgrade_seeds(
    collection_name: str,
    candidate_seed_path: str | Path,
    *,
    source_files: list[str] | None = None,
    manifest_path: Path = MANIFEST_PATH,
    seed_dir: Path = SEED_DIR,
    client: chromadb.ClientAPI | None = None,
) -> dict[str, Any]:
    """Replace active seeds for a collection, reseed Chroma, and update manifest."""

    if collection_name not in COLLECTION_CONFIG:
        raise ValueError(f"Unsupported collection: {collection_name}")

    candidate_path = Path(candidate_seed_path)
    validated_items = _read_validated_items(collection_name, candidate_path)
    if not validated_items:
        raise ValueError(f"{collection_name}: candidate seed file is empty")

    manifest = load_manifest(manifest_path=manifest_path, seed_dir=seed_dir)
    entry = manifest["collections"].setdefault(collection_name, _bootstrap_entry(collection_name, seed_dir=seed_dir))
    active_file = seed_dir / COLLECTION_CONFIG[collection_name]["filename"]
    current_version = _safe_text(entry.get("active_version")) or "unknown"
    new_version = validated_items[0].version

    if active_file.exists():
        current_snapshot = _ensure_snapshot(
            collection_name,
            version=current_version,
            source_path=active_file,
            seed_dir=seed_dir,
        )
        _upsert_history_entry(
            entry,
            {
                "version": current_version,
                "count": entry.get("count", 0),
                "snapshot_file": current_snapshot.relative_to(seed_dir).as_posix(),
                "recorded_at": _utc_now(),
            },
        )

    new_snapshot = _ensure_snapshot(
        collection_name,
        version=new_version,
        source_path=candidate_path,
        seed_dir=seed_dir,
    )
    shutil.copy2(new_snapshot, active_file)
    reseeded_count = _reseed_collection(collection_name, validated_items, client=client)

    entry.update(
        {
            "active_version": new_version,
            "count": reseeded_count,
            "source_files": source_files or [candidate_path.name],
            "active_file": active_file.name,
            "last_action": "upgrade",
            "last_action_at": _utc_now(),
        }
    )
    _upsert_history_entry(
        entry,
        {
            "version": new_version,
            "count": reseeded_count,
            "snapshot_file": new_snapshot.relative_to(seed_dir).as_posix(),
            "recorded_at": _utc_now(),
        },
    )
    save_manifest(manifest, manifest_path=manifest_path)
    return {
        "collection": collection_name,
        "active_version": new_version,
        "count": reseeded_count,
        "active_file": str(active_file),
    }


def rollback_seeds(
    collection_name: str,
    *,
    version: str | None = None,
    manifest_path: Path = MANIFEST_PATH,
    seed_dir: Path = SEED_DIR,
    client: chromadb.ClientAPI | None = None,
) -> dict[str, Any]:
    """Restore a previous seed snapshot and reseed the collection."""

    if collection_name not in COLLECTION_CONFIG:
        raise ValueError(f"Unsupported collection: {collection_name}")

    manifest = load_manifest(manifest_path=manifest_path, seed_dir=seed_dir)
    entry = manifest["collections"][collection_name]
    history = entry.get("history", [])
    if not history:
        raise ValueError(f"{collection_name}: no rollback history available")

    target_history_item: dict[str, Any] | None = None
    if version:
        for item in history:
            if item.get("version") == version:
                target_history_item = item
                break
        if target_history_item is None:
            raise ValueError(f"{collection_name}: version '{version}' not found in manifest history")
    else:
        current_version = entry.get("active_version")
        previous_versions = [item for item in history if item.get("version") != current_version]
        if not previous_versions:
            raise ValueError(f"{collection_name}: no previous version available for rollback")
        target_history_item = previous_versions[-1]

    snapshot_path = seed_dir / target_history_item["snapshot_file"]
    if not snapshot_path.exists():
        raise FileNotFoundError(f"Snapshot file not found: {snapshot_path}")

    validated_items = _read_validated_items(collection_name, snapshot_path)
    active_file = seed_dir / COLLECTION_CONFIG[collection_name]["filename"]
    shutil.copy2(snapshot_path, active_file)
    reseeded_count = _reseed_collection(collection_name, validated_items, client=client)

    entry.update(
        {
            "active_version": target_history_item["version"],
            "count": reseeded_count,
            "source_files": [active_file.name],
            "active_file": active_file.name,
            "last_action": "rollback",
            "last_action_at": _utc_now(),
        }
    )
    save_manifest(manifest, manifest_path=manifest_path)
    return {
        "collection": collection_name,
        "active_version": target_history_item["version"],
        "count": reseeded_count,
        "active_file": str(active_file),
    }
