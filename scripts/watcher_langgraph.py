from __future__ import annotations

import argparse
from typing import Callable, Literal, TypedDict

from langgraph.graph import END, START, StateGraph


ExecutionStage = Literal[
    "duplicate",
    "blocked",
    "drift",
    "ready",
    "result",
    "unknown",
    "verify_pass",
    "verify_fail",
    "review_required",
]


class WatcherGraphState(TypedDict, total=False):
    task_id: str
    preflight_stage: ExecutionStage
    inspection_stage: ExecutionStage
    implementation_stage: ExecutionStage
    verification_stage: ExecutionStage
    review_stage: ExecutionStage


def _identity_node(name: str) -> Callable[[WatcherGraphState], WatcherGraphState]:
    def _node(state: WatcherGraphState) -> WatcherGraphState:
        next_state = dict(state)
        next_state["last_node"] = name
        return next_state

    return _node


def _route_preflight(state: WatcherGraphState) -> str:
    return state.get("preflight_stage", "ready")


def _route_inspection(state: WatcherGraphState) -> str:
    return state.get("inspection_stage", "ready")


def _route_implementation_current(state: WatcherGraphState) -> str:
    return state.get("implementation_stage", "unknown")


def _route_implementation_proposed(state: WatcherGraphState) -> str:
    return state.get("implementation_stage", "unknown")


def _route_verification(state: WatcherGraphState) -> str:
    return state.get("verification_stage", "verify_fail")


def _route_review(state: WatcherGraphState) -> str:
    return state.get("review_stage", "review_required")


def build_current_execution_graph():
    graph = StateGraph(WatcherGraphState)
    graph.add_node("preflight", _identity_node("preflight"))
    graph.add_node("duplicate_skip", _identity_node("duplicate_skip"))
    graph.add_node("move_blocked", _identity_node("move_blocked"))
    graph.add_node("move_drifted", _identity_node("move_drifted"))
    graph.add_node("supervisor_inspection", _identity_node("supervisor_inspection"))
    graph.add_node("supervisor_implementation", _identity_node("supervisor_implementation"))
    graph.add_node("supervisor_verification", _identity_node("supervisor_verification"))
    graph.add_node("manual_review", _identity_node("manual_review"))
    graph.add_node("complete_task", _identity_node("complete_task"))

    graph.add_edge(START, "preflight")
    graph.add_conditional_edges(
        "preflight",
        _route_preflight,
        {
            "duplicate": "duplicate_skip",
            "blocked": "move_blocked",
            "drift": "move_drifted",
            "ready": "supervisor_inspection",
        },
    )
    graph.add_conditional_edges(
        "supervisor_inspection",
        _route_inspection,
        {
            "blocked": "move_blocked",
            "drift": "move_drifted",
            "ready": "supervisor_implementation",
        },
    )
    graph.add_conditional_edges(
        "supervisor_implementation",
        _route_implementation_proposed,
        {
            "result": "supervisor_verification",
            "blocked": "move_blocked",
            "drift": "move_drifted",
            "unknown": "move_blocked",
        },
    )
    graph.add_conditional_edges(
        "supervisor_verification",
        _route_verification,
        {
            "verify_pass": "complete_task",
            "verify_fail": "manual_review",
        },
    )

    graph.add_edge("duplicate_skip", END)
    graph.add_edge("move_blocked", END)
    graph.add_edge("move_drifted", END)
    graph.add_edge("complete_task", END)
    graph.add_edge("manual_review", END)
    return graph.compile()


def build_proposed_execution_graph():
    graph = StateGraph(WatcherGraphState)
    graph.add_node("preflight", _identity_node("preflight"))
    graph.add_node("duplicate_skip", _identity_node("duplicate_skip"))
    graph.add_node("move_blocked", _identity_node("move_blocked"))
    graph.add_node("move_drifted", _identity_node("move_drifted"))
    graph.add_node("supervisor_inspection", _identity_node("supervisor_inspection"))
    graph.add_node("supervisor_implementation", _identity_node("supervisor_implementation"))
    graph.add_node("supervisor_verification", _identity_node("supervisor_verification"))
    graph.add_node("manual_review", _identity_node("manual_review"))
    graph.add_node("complete_task", _identity_node("complete_task"))

    graph.add_edge(START, "preflight")
    graph.add_conditional_edges(
        "preflight",
        _route_preflight,
        {
            "duplicate": "duplicate_skip",
            "blocked": "move_blocked",
            "drift": "move_drifted",
            "ready": "supervisor_inspection",
        },
    )
    graph.add_conditional_edges(
        "supervisor_inspection",
        _route_inspection,
        {
            "blocked": "move_blocked",
            "drift": "move_drifted",
            "ready": "supervisor_implementation",
        },
    )
    graph.add_conditional_edges(
        "supervisor_implementation",
        _route_implementation_proposed,
        {
            "blocked": "move_blocked",
            "drift": "move_drifted",
            "result": "supervisor_verification",
            "unknown": "move_blocked",
        },
    )
    graph.add_conditional_edges(
        "supervisor_verification",
        _route_verification,
        {
            "verify_pass": "complete_task",
            "verify_fail": "manual_review",
        },
    )
    graph.add_conditional_edges(
        "manual_review",
        _route_review,
        {
            "review_required": END,
        },
    )

    graph.add_edge("duplicate_skip", END)
    graph.add_edge("move_blocked", END)
    graph.add_edge("move_drifted", END)
    graph.add_edge("complete_task", END)
    return graph.compile()


CURRENT_EXECUTION_MERMAID = """flowchart TD
    START([Start]) --> preflight[preflight]
    preflight -->|duplicate| duplicate_skip[duplicate_skip]
    preflight -->|blocked| move_blocked[move_blocked]
    preflight -->|drift| move_drifted[move_drifted]
    preflight -->|ready| supervisor_inspection[supervisor_inspection]
    supervisor_inspection -->|blocked| move_blocked
    supervisor_inspection -->|drift| move_drifted
    supervisor_inspection -->|ready| supervisor_implementation[supervisor_implementation]
    supervisor_implementation -->|result| supervisor_verification[supervisor_verification]
    supervisor_implementation -->|blocked| move_blocked
    supervisor_implementation -->|drift| move_drifted
    supervisor_implementation -->|unknown| move_blocked
    supervisor_verification -->|verify_pass| complete_task[complete_task]
    supervisor_verification -->|verify_fail| manual_review[manual_review]
    duplicate_skip --> END([End])
    move_blocked --> END
    move_drifted --> END
    complete_task --> END
    manual_review --> END
"""


PROPOSED_EXECUTION_MERMAID = """flowchart TD
    START([Start]) --> preflight[preflight]
    preflight -->|duplicate| duplicate_skip[duplicate_skip]
    preflight -->|blocked| move_blocked[move_blocked]
    preflight -->|drift| move_drifted[move_drifted]
    preflight -->|ready| supervisor_inspection[supervisor_inspection]
    supervisor_inspection -->|blocked| move_blocked
    supervisor_inspection -->|drift| move_drifted
    supervisor_inspection -->|ready| supervisor_implementation[supervisor_implementation]
    supervisor_implementation -->|blocked| move_blocked
    supervisor_implementation -->|drift| move_drifted
    supervisor_implementation -->|result| supervisor_verification[supervisor_verification]
    supervisor_implementation -->|unknown| move_blocked
    supervisor_verification -->|verify_pass| complete_task[complete_task]
    supervisor_verification -->|verify_fail| manual_review[manual_review]
    manual_review -->|review_required| END([End])
    duplicate_skip --> END
    move_blocked --> END
    move_drifted --> END
    complete_task --> END
"""


GRAPH_REGISTRY = {
    "current-execution": (build_current_execution_graph, CURRENT_EXECUTION_MERMAID),
    "proposed-execution": (build_proposed_execution_graph, PROPOSED_EXECUTION_MERMAID),
}


def render_mermaid(graph_name: str) -> str:
    if graph_name not in GRAPH_REGISTRY:
        raise KeyError(f"Unknown graph: {graph_name}")
    return GRAPH_REGISTRY[graph_name][1]


def main() -> None:
    parser = argparse.ArgumentParser(description="Render watcher supervisor LangGraph diagrams.")
    parser.add_argument(
        "--graph",
        choices=sorted(GRAPH_REGISTRY.keys()),
        default="current-execution",
        help="Graph variant to render.",
    )
    args = parser.parse_args()
    print(render_mermaid(args.graph))


if __name__ == "__main__":
    main()
