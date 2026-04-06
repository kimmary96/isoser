# ChromaDB 초기 데이터 적재 스크립트 - 서버 첫 시작 또는 수동으로 실행
import json
import os
import sys
from pathlib import Path

import chromadb
from chromadb.config import Settings

from check_python_version import main as assert_python_version

SEED_DIR = Path(__file__).parent / "seed_data"
PERSIST_DIR = os.environ.get("CHROMA_PERSIST_DIR", "./chroma_store")


def seed_job_keywords(collection: chromadb.Collection) -> None:
    """
    job_keywords.json에서 직무 키워드 패턴을 읽어 ChromaDB에 적재한다.
    이미 데이터가 있으면 건너뛴다.
    """
    if collection.count() > 0:
        print("[seed] job_keyword_patterns: 이미 데이터 있음, 건너뜀")
        return

    with open(SEED_DIR / "job_keywords.json", encoding="utf-8") as f:
        data: list[dict] = json.load(f)

    if not data:
        print("[seed] job_keywords.json이 비어 있습니다. STEP 2에서 데이터를 추가하세요.")
        return

    documents = [item["pattern"] for item in data]
    metadatas = [{"job": item["job"], "keywords": ",".join(item["keywords"])} for item in data]
    ids = [f"jk_{i}" for i in range(len(data))]

    collection.add(documents=documents, metadatas=metadatas, ids=ids)
    print(f"[seed] job_keyword_patterns: {len(data)}건 적재 완료")


def seed_star_examples(collection: chromadb.Collection) -> None:
    """
    star_examples.json에서 STAR 예시를 읽어 ChromaDB에 적재한다.
    이미 데이터가 있으면 건너뛴다.
    """
    if collection.count() > 0:
        print("[seed] star_examples: 이미 데이터 있음, 건너뜀")
        return

    with open(SEED_DIR / "star_examples.json", encoding="utf-8") as f:
        data: list[dict] = json.load(f)

    if not data:
        print("[seed] star_examples.json이 비어 있습니다. STEP 2에서 데이터를 추가하세요.")
        return

    documents = [item["improved"] for item in data]
    metadatas = [
        {
            "original": item["original"],
            "missing_before": ",".join(item.get("missing_before", [])),
        }
        for item in data
    ]
    ids = [f"se_{i}" for i in range(len(data))]

    collection.add(documents=documents, metadatas=metadatas, ids=ids)
    print(f"[seed] star_examples: {len(data)}건 적재 완료")


def main() -> None:
    """ChromaDB에 시드 데이터를 적재하는 메인 함수."""
    print(f"[seed] ChromaDB 초기화 - 저장 경로: {PERSIST_DIR}")
    client = chromadb.PersistentClient(
        path=PERSIST_DIR,
        settings=Settings(anonymized_telemetry=False),
    )

    job_collection = client.get_or_create_collection(
        name="job_keyword_patterns",
        metadata={"hnsw:space": "cosine"},
    )
    star_collection = client.get_or_create_collection(
        name="star_examples",
        metadata={"hnsw:space": "cosine"},
    )

    seed_job_keywords(job_collection)
    seed_star_examples(star_collection)
    print("[seed] 완료")


if __name__ == "__main__":
    # backend/ 디렉토리에서 실행: python rag/seed.py
    sys.path.insert(0, str(Path(__file__).parent.parent))
    assert_python_version()
    main()
