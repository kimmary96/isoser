# FastAPI 앱 진입점 - CORS 설정, 라우터 등록, 서버 시작 시 ChromaDB 초기화
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from check_python_version import main as assert_python_version
from logging_config import configure_logging
from rag.runtime_config import load_backend_dotenv

configure_logging()
load_backend_dotenv()
assert_python_version()

from routers import activities, parse, coach, match, company
from rag.chroma_client import get_chroma_health_summary, init_chroma


@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작/종료 생명주기 관리."""
    # 시작 시: ChromaDB 초기화
    init_chroma()
    yield
    # 종료 시: 정리 작업 (필요 시 추가)


app = FastAPI(
    title="이소서 API",
    description="AI 코치 기반 이력서·경력기술서 편집 서비스 백엔드",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 설정 - 프론트엔드(Vercel) 및 로컬 개발 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app|http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(parse.router, prefix="/parse", tags=["parse"])
app.include_router(coach.router, prefix="/coach", tags=["coach"])
app.include_router(match.router, prefix="/match", tags=["match"])
app.include_router(activities.router, prefix="/activities", tags=["activities"])


@app.get("/")
async def root() -> dict:
    """헬스 체크 엔드포인트."""
    return {"status": "ok", "service": "이소서 API"}


@app.get("/health")
async def health() -> dict:
    """Return app status plus Chroma collection diagnostics."""

    chroma_summary = get_chroma_health_summary()
    return {
        "status": "ok",
        "service": "이소서 API",
        "chroma": chroma_summary,
    }
