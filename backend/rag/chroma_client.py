# ChromaDB 초기화 및 클라이언트 - 서버 시작 시 자동 초기화, 검색 함수 제공
import os
import chromadb
from chromadb.config import Settings

_client: chromadb.ClientAPI | None = None
_job_collection: chromadb.Collection | None = None
_star_collection: chromadb.Collection | None = None


def init_chroma() -> None:
    """
    ChromaDB 클라이언트를 초기화하고 컬렉션을 로드한다.
    실패 시 서버가 죽지 않고 RAG 없이 동작하도록 fallback 처리한다.
    """
    global _client, _job_collection, _star_collection

    try:
        persist_dir = os.environ.get("CHROMA_PERSIST_DIR", "./chroma_store")
        _client = chromadb.PersistentClient(
            path=persist_dir,
            settings=Settings(anonymized_telemetry=False),
        )
        _job_collection = _client.get_or_create_collection(
            name="job_keyword_patterns",
            metadata={"hnsw:space": "cosine"},
        )
        _star_collection = _client.get_or_create_collection(
            name="star_examples",
            metadata={"hnsw:space": "cosine"},
        )
        print(f"[ChromaDB] 초기화 완료 - 저장 경로: {persist_dir}")
    except Exception as e:
        print(f"[ChromaDB] 초기화 실패 (RAG 없이 동작): {e}")
        _client = None
        _job_collection = None
        _star_collection = None


def get_job_collection() -> chromadb.Collection | None:
    """직무 키워드 패턴 컬렉션을 반환한다."""
    return _job_collection


def get_star_collection() -> chromadb.Collection | None:
    """STAR 예시 컬렉션을 반환한다."""
    return _star_collection


def search_job_keywords(job_title: str, n_results: int = 3) -> list[str]:
    """
    직무명으로 관련 키워드 패턴을 검색한다.

    Args:
        job_title: 검색할 직무명
        n_results: 반환할 결과 수

    Returns:
        관련 패턴 텍스트 목록
    """
    if _job_collection is None:
        return []

    try:
        results = _job_collection.query(
            query_texts=[job_title],
            n_results=min(n_results, _job_collection.count()),
        )
        docs = results.get("documents", [[]])[0]
        return docs
    except Exception:
        return []


def search_star_examples(activity_text: str, n_results: int = 2) -> list[str]:
    """
    활동 설명과 유사한 STAR 예시를 검색한다.

    Args:
        activity_text: 검색할 활동 설명 텍스트
        n_results: 반환할 결과 수

    Returns:
        관련 STAR 예시 텍스트 목록
    """
    if _star_collection is None:
        return []

    try:
        count = _star_collection.count()
        if count == 0:
            return []
        results = _star_collection.query(
            query_texts=[activity_text],
            n_results=min(n_results, count),
        )
        docs = results.get("documents", [[]])[0]
        return docs
    except Exception:
        return []
