# Program Detail Page Ad-hoc Request Blocked

## 상태

blocked

## 차단 이유

사용자 요청은 `programs` 상세 페이지 구현 작업이지만, 저장소 최상위 규칙(`AGENTS.md`)이 요구하는 task packet frontmatter가 없습니다.

필수 누락 항목:

- `id`
- `status`
- `type`
- `title`
- `planned_at`
- `planned_against_commit`

`AGENTS.md`의 "Task packet requirements"에 따라 필수 항목이 없으면 구현 전에 `reports/<task-id>-blocked.md`를 작성하고 중단해야 하므로, 코드 변경을 진행하지 않았습니다.

## 사용자가 요청한 작업 요약

- `programs` 목록에서 상세 보기 클릭 시 열리는 상세 페이지 구현
- 제공 HTML 시안(`C:\Users\User\Downloads\isoser-program-detail.html`)과 유사한 상세 레이아웃 반영
- 실제 상세 API 응답 기반 렌더링
- 데이터 없는 후기, FAQ, 주차별 커리큘럼, 유사 프로그램 등은 가짜 데이터 없이 숨김
- Hero, 탭, 본문 카드, 사이드바, 목차, 아코디언, 북마크 UI 상태, 반응형 구현

## 확인한 문서

- `AGENTS.md`
- `docs/agent-playbook.md`
- `docs/current-state.md`
- `docs/rules/session-start-template.md`
- `C:\Users\User\Downloads\isoser-program-detail.html`

## 현재 확인된 관련 상태

- `docs/current-state.md` 기준 현재 상세 API는 `GET /programs/{program_id}/detail`입니다.
- 현재 상세 페이지 파일은 문서상 `frontend/app/(landing)/programs/[id]/page.tsx`입니다.
- 현재 상세 페이지는 값이 없는 provider/location/description/선택 운영 정보에 대해 필드별 `정보 없음`을 남발하지 않고 chip 또는 섹션을 숨기는 방향으로 이미 일부 정리되어 있습니다.

## 다음 진행 조건

아래 frontmatter를 가진 task packet을 `tasks/inbox/` 또는 승인된 작업 흐름에 맞는 위치에 제공해야 구현을 시작할 수 있습니다.

```yaml
---
id: TASK-YYYY-MM-DD-####-program-detail-page
status: approved
type: feature
title: Programs detail page implementation
planned_at: YYYY-MM-DDTHH:mm:ss+09:00
planned_against_commit: <current git commit hash>
---
```

## 구현 재개 시 우선 확인할 대상

- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/[id]/page.tsx`
- `frontend/lib/api/*`
- `backend/routers/programs.py`
- `frontend/components/landing/*`
- `reports/`의 프로그램 상세/비교 관련 과거 결과
- `docs/refactoring-log.md`
