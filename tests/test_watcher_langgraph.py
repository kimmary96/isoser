from __future__ import annotations

from scripts import watcher_langgraph


def test_current_execution_mermaid_includes_supervisor_handoff() -> None:
    mermaid = watcher_langgraph.render_mermaid("current-execution")

    assert "supervisor_inspection" in mermaid
    assert "supervisor_implementation" in mermaid
    assert "supervisor_verification" in mermaid
    assert "manual_review" in mermaid
    assert "complete_task" in mermaid
    assert "verify_pass" in mermaid


def test_proposed_execution_mermaid_includes_verification_gate() -> None:
    mermaid = watcher_langgraph.render_mermaid("proposed-execution")

    assert "supervisor_verification" in mermaid
    assert "manual_review" in mermaid
    assert "verify_pass" in mermaid
    assert "verify_fail" in mermaid


def test_graph_registry_builders_compile() -> None:
    current_graph = watcher_langgraph.build_current_execution_graph()
    proposed_graph = watcher_langgraph.build_proposed_execution_graph()

    assert current_graph is not None
    assert proposed_graph is not None
