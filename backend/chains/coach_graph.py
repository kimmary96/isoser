# LangGraph AI 코치 그래프 - STAR 기법 멀티턴 피드백 상태 관리
import os
import json
from typing import TypedDict

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, END

from rag.chroma_client import search_job_keywords, search_star_examples


class CoachState(TypedDict):
    """AI 코치 그래프 상태."""
    activity_text: str
    job_title: str
    history: list
    rag_context: str           # ChromaDB 검색 결과
    missing_elements: list     # 아직 보완 안 된 STAR 요소
    feedback: str
    iteration_count: int


def _get_llm() -> ChatGoogleGenerativeAI:
    """Gemini 2.5 Flash LLM 인스턴스를 반환한다."""
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.environ["GOOGLE_API_KEY"],
    )


def rag_search_node(state: CoachState) -> CoachState:
    """ChromaDB에서 직무 키워드 패턴과 STAR 예시를 검색한다."""
    try:
        keyword_docs = search_job_keywords(state["job_title"])
        star_docs = search_star_examples(state["activity_text"])
        rag_context = "\n".join([
            "=== 직무 키워드 패턴 ===",
            "\n".join(keyword_docs),
            "=== STAR 예시 ===",
            "\n".join(star_docs),
        ])
    except Exception:
        # ChromaDB 장애 시 RAG 없이 동작 (fallback)
        rag_context = ""

    return {**state, "rag_context": rag_context}


async def analyze_node(state: CoachState) -> CoachState:
    """활동 설명을 분석해 빠진 STAR 요소를 파악한다."""
    llm = _get_llm()

    prompt = f"""다음 활동 설명을 STAR(Situation, Task, Action, Result) 기법으로 분석하세요.
빠진 요소만 리스트로 반환하세요. 예: ["Situation", "Result", "정량화"]

직무: {state["job_title"]}
활동 설명: {state["activity_text"]}
참고 패턴: {state["rag_context"][:2000] if state["rag_context"] else "없음"}

빠진 STAR 요소 (JSON 배열만 반환):"""

    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        missing = json.loads(str(response.content).strip())
        if not isinstance(missing, list):
            missing = []
    except Exception:
        missing = []

    return {**state, "missing_elements": missing}


async def feedback_node(state: CoachState) -> CoachState:
    """분석 결과를 바탕으로 구체적인 피드백 문장을 생성한다."""
    llm = _get_llm()

    history_text = "\n".join([
        f"{'유저' if m['role'] == 'user' else '코치'}: {m['content']}"
        for m in state["history"][-6:]  # 최근 6턴만 포함
    ])

    missing_text = ", ".join(state["missing_elements"]) if state["missing_elements"] else "없음"

    prompt = f"""당신은 이력서 AI 코치입니다. 유저가 직접 고칠 수 있도록 구체적인 피드백을 한국어로 제공하세요.
대신 써주지 말고, 무엇이 빠졌는지 + 어떻게 추가하면 좋은지 방향만 안내하세요.

직무: {state["job_title"]}
활동 설명: {state["activity_text"]}
빠진 STAR 요소: {missing_text}
참고 패턴: {state["rag_context"][:1500] if state["rag_context"] else "없음"}

이전 대화:
{history_text if history_text else "없음"}

피드백:"""

    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        feedback = response.content
    except Exception as e:
        feedback = f"피드백 생성 중 오류가 발생했습니다: {str(e)}"

    return {**state, "feedback": feedback}


def _build_coach_graph() -> StateGraph:
    """AI 코치 LangGraph 그래프를 빌드하고 반환한다."""
    graph = StateGraph(CoachState)

    graph.add_node("rag_search", rag_search_node)
    graph.add_node("analyze", analyze_node)
    graph.add_node("feedback_step", feedback_node)

    graph.set_entry_point("rag_search")
    graph.add_edge("rag_search", "analyze")
    graph.add_edge("analyze", "feedback_step")
    graph.add_edge("feedback_step", END)

    return graph.compile()


# 그래프 인스턴스 (모듈 로드 시 1회 컴파일)
_coach_graph = _build_coach_graph()


async def run_coach_graph(
    session_id: str,
    activity_text: str,
    job_title: str,
    history: list,
) -> dict:
    """
    AI 코치 LangGraph를 실행하고 피드백 결과를 반환한다.

    Args:
        session_id: 세션 식별자
        activity_text: 유저가 입력한 활동 설명
        job_title: 지원 직무명
        history: 이전 대화 이력

    Returns:
        feedback, missing_elements, iteration_count, updated_history
    """
    initial_state: CoachState = {
        "activity_text": activity_text,
        "job_title": job_title,
        "history": history,
        "rag_context": "",
        "missing_elements": [],
        "feedback": "",
        "iteration_count": len(history) // 2 + 1,
    }

    result = await _coach_graph.ainvoke(initial_state)

    updated_history = history + [
        {"role": "user", "content": activity_text},
        {"role": "assistant", "content": result["feedback"]},
    ]

    return {
        "feedback": result["feedback"],
        "missing_elements": result["missing_elements"],
        "iteration_count": result["iteration_count"],
        "updated_history": updated_history,
    }
