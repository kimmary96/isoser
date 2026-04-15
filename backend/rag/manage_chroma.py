# ChromaDB 작업용 보조 CLI - taxonomy 생성, seed 적재, 상태 점검을 한 곳에서 수행
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import chromadb
from chromadb.config import Settings

BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from rag.build_job_taxonomy import main as build_job_taxonomy_main
from rag.chroma_client import build_embedding_function
from rag.runtime_config import BACKEND_DIR as BACKEND_ROOT, load_backend_dotenv, resolve_chroma_persist_dir
from rag.seed import main as seed_main
from rag.source_adapters.catalog import ALL_API_SOURCES

SEED_DIR = Path(__file__).parent / "seed_data"
SOURCE_BY_NAME = {source.source_name: source for source in ALL_API_SOURCES}


def _get_client() -> chromadb.ClientAPI:
    persist_dir = resolve_chroma_persist_dir()
    return chromadb.PersistentClient(
        path=str(persist_dir),
        settings=Settings(anonymized_telemetry=False),
    )


def doctor() -> int:
    """현재 Chroma 작업 환경을 점검한다."""
    load_backend_dotenv()
    persist_dir = resolve_chroma_persist_dir()
    required_seed_files = [
        SEED_DIR / "job_keyword_patterns.json",
        SEED_DIR / "star_examples.json",
        SEED_DIR / "job_posting_snippets.json",
        SEED_DIR / "job_taxonomy.json",
    ]

    print("[doctor] backend root:", BACKEND_ROOT)
    print("[doctor] chroma persist dir:", persist_dir)
    print("[doctor] seed files:")
    for path in required_seed_files:
        print(f"  - {path.name}: {'ok' if path.exists() else 'missing'}")

    client = _get_client()
    embedding_fn = build_embedding_function()
    job_collection = client.get_or_create_collection(
        name="job_keyword_patterns",
        metadata={"hnsw:space": "cosine"},
        embedding_function=embedding_fn,
    )
    star_collection = client.get_or_create_collection(
        name="star_examples",
        metadata={"hnsw:space": "cosine"},
        embedding_function=embedding_fn,
    )
    posting_collection = client.get_or_create_collection(
        name="job_posting_snippets",
        metadata={"hnsw:space": "cosine"},
        embedding_function=embedding_fn,
    )
    print("[doctor] collections:")
    print(f"  - job_keyword_patterns: {job_collection.count()}")
    print(f"  - star_examples: {star_collection.count()}")
    print(f"  - job_posting_snippets: {posting_collection.count()}")
    return 0


def prepare() -> int:
    """taxonomy 생성 후 seed 적재까지 한 번에 수행한다."""
    load_backend_dotenv()
    print("[prepare] step 1/2: build taxonomy")
    build_job_taxonomy_main()
    print("[prepare] step 2/2: seed chroma")
    seed_main()
    print("[prepare] done")
    return doctor()


def dump_collection(collection_name: str, limit: int) -> int:
    """컬렉션 일부 문서를 빠르게 확인한다."""
    load_backend_dotenv()
    client = _get_client()
    embedding_fn = build_embedding_function()
    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
        embedding_function=embedding_fn,
    )
    peek = collection.get(limit=limit, include=["documents", "metadatas"])
    print(json.dumps(peek, ensure_ascii=False, indent=2))
    return 0


def show_sources() -> int:
    """Show external source readiness based on current env configuration."""
    load_backend_dotenv()
    rows = [source.describe_status().to_dict() for source in ALL_API_SOURCES]
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    return 0


def show_request_spec(
    source_name: str,
    endpoint_url: str,
    raw_params: list[str],
    *,
    use_infuser_header: bool,
) -> int:
    """Build and print a redacted request spec for a configured source adapter."""
    load_backend_dotenv()
    source = SOURCE_BY_NAME[source_name]
    extra_params: dict[str, str] = {}

    for item in raw_params:
        key, separator, value = item.partition("=")
        if not separator or not key:
            print(f"[request-spec] invalid --param value: {item}", file=sys.stderr)
            return 1
        extra_params[key] = value

    try:
        spec = source.build_request_spec(
            endpoint_url,
            extra_params=extra_params,
            use_infuser_header=use_infuser_header,
        )
    except ValueError as exc:
        print(f"[request-spec] {exc}", file=sys.stderr)
        return 1

    print(
        json.dumps(
            spec.to_safe_dict(
                secret_param_names={source.auth_param_name},
                redact_authorization=use_infuser_header,
            ),
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="ChromaDB local workflow helper")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("doctor", help="check local Chroma env and collection counts")
    subparsers.add_parser("prepare", help="build taxonomy and seed Chroma in one run")
    subparsers.add_parser("sources", help="show Work24/NCS source readiness from env")

    dump_parser = subparsers.add_parser("dump", help="peek a collection")
    dump_parser.add_argument(
        "collection",
        choices=["job_keyword_patterns", "star_examples", "job_posting_snippets"],
    )
    dump_parser.add_argument("--limit", type=int, default=3)

    request_parser = subparsers.add_parser(
        "request-spec",
        help="build a redacted request spec for a source adapter",
    )
    request_parser.add_argument("source", choices=sorted(SOURCE_BY_NAME))
    request_parser.add_argument("endpoint")
    request_parser.add_argument(
        "--param",
        action="append",
        default=[],
        dest="params",
        help="repeatable query param in key=value form",
    )
    request_parser.add_argument(
        "--infuser-header",
        action="store_true",
        help="use Authorization: Infuser {API_KEY} instead of query auth",
    )

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "doctor":
        return doctor()
    if args.command == "prepare":
        return prepare()
    if args.command == "sources":
        return show_sources()
    if args.command == "dump":
        return dump_collection(args.collection, args.limit)
    if args.command == "request-spec":
        return show_request_spec(
            args.source,
            args.endpoint,
            args.params,
            use_infuser_header=args.infuser_header,
        )

    parser.error(f"unsupported command: {args.command}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
