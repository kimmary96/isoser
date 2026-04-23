---
id: TASK-2026-04-23-program-list-hardening
status: done
type: refactor
title: Program list read-model hardening, promoted layer, and performance validation
planned_at: 2026-04-23T19:20:00+09:00
planned_against_commit: 7dd37e56d597616238306b3624c14b30d2c61c7a
---

# Task

Harden the current programs/camps list read-model implementation after the current-state audit.

## Scope

- Add a concrete promoted/ad list layer using a Fast Campus sponsored placement assumption.
- Keep promoted rows separate from organic rows and prevent duplicate exposure.
- Preserve the existing list API compatibility while adding an explicit promoted payload.
- Fix remaining read-model query issues that can break cursor/filter behavior.
- Keep the existing `scope=all` fix and add coverage around it.
- Add systematic before/after performance benchmarking support.
- Update tests, runtime docs, refactoring log, and result/performance reports.

## Constraints

- Preserve existing public `/programs` array response behavior.
- Do not introduce a new external search engine.
- Do not undo existing uncommitted user/automation changes.
- Keep changes minimal and localized to the programs list read-model surface.
