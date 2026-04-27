# SESSION-2026-04-27 Activity Coach Diagnosis UI And Quota Fallback Result

## Changed files
- `frontend/app/dashboard/activities/_components/activity-coach-panel.tsx`
- `frontend/app/dashboard/activities/_components/activity-coach-panel.test.tsx`
- `frontend/app/dashboard/activities/[id]/page.tsx`
- `frontend/app/dashboard/activities/_hooks/use-activity-detail.ts`
- `backend/chains/coach_graph.py`
- `backend/tests/test_coach_e2e.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 사용자가 일반 질문을 보냈는데 `코칭 진단`이 먼저 표시되고, 좁은 채팅 박스 안에 진단 카드와 quota 오류 원문이 함께 들어가 UX가 답답해지는 문제가 있었다.
- 진단은 STAR 완성 후 명시적으로 실행하는 분석 결과이고, 채팅은 질문/응답 흐름이므로 화면과 상태를 분리할 필요가 있었다.

## Preserved behaviors
- 기존 `/coach/feedback` API 계약과 `CoachFeedbackResponse` 구조는 유지했다.
- AI 코치 채팅 전송, 지원 직무 입력, 문장 후보의 소개글/STAR/기여내용 적용 동작은 유지했다.
- 서버 저장은 기존처럼 사용자가 저장 버튼을 눌렀을 때만 수행된다.

## Result
- STAR 탭은 왼쪽 STAR 입력, 가운데 긴 AI 채팅, 오른쪽 진단 패널의 3열 구조로 표시된다.
- 진단 전 오른쪽 패널에는 `STAR 작성후 AI 코치의 진단을 받아보세요!` 안내와 진단 예시 카드가 표시된다.
- 일반 채팅 질문은 `lastCoachResponse`를 갱신하지 않아 진단 패널을 자동 생성하지 않는다.
- STAR 4개 항목이 모두 채워진 뒤 `코칭 진단` 버튼을 눌러야 오른쪽 진단 패널이 생성된다.
- 채팅 메시지는 긴 URL/오류 문자열도 줄바꿈해 가로 스크롤로 박스를 밀지 않는다.
- Gemini quota/rate-limit 오류는 raw provider 오류와 링크를 노출하지 않고 사용자용 fallback 안내로 변환된다.

## Risks / possible regressions
- 진단 버튼은 STAR 4개 항목이 모두 채워진 경우에만 활성화되므로, 부분 작성 상태에서도 진단을 원하던 사용자는 먼저 STAR를 채워야 한다.
- 진단 요청은 채팅 history를 비워 실행하므로, 일반 채팅에서 나눈 추가 맥락은 진단에 자동 반영되지 않는다. 필요한 경우 STAR 입력 또는 기본 정보에 반영한 뒤 진단해야 한다.
- 실제 Gemini free-tier quota 자체는 코드로 늘릴 수 없으며, 이번 변경은 quota 초과 시 UI/응답이 깨지지 않게 하는 fallback 처리다.

## Follow-up refactoring candidates
- 채팅용 endpoint와 진단용 endpoint를 API 레벨에서 분리해 prompt 목적을 더 명확히 나눌 수 있다.
- 진단 패널이 없는 상태의 오른쪽 빈 영역에 마지막 진단 시간이나 최소 안내 상태를 둘지 UX 검토가 필요하다.
- 진단 요청에도 사용자가 선택한 최근 채팅 맥락 일부를 명시적으로 포함하는 옵션을 검토할 수 있다.

## Verification
- `npm --prefix frontend test -- app/dashboard/activities/_components/activity-coach-panel.test.tsx app/dashboard/activities/_components/activity-coach-insight-panel.test.tsx app/dashboard/activities/_lib/activity-coach-insight.test.ts app/dashboard/activities/_lib/activity-coach-context.test.ts`
- `npm --prefix frontend run lint -- --file app/dashboard/activities/_components/activity-coach-panel.tsx --file app/dashboard/activities/_components/activity-coach-panel.test.tsx --file app/dashboard/activities/_components/activity-coach-insight-panel.tsx --file app/dashboard/activities/_components/activity-coach-insight-panel.test.tsx --file app/dashboard/activities/_hooks/use-activity-detail.ts --file app/dashboard/activities/[id]/page.tsx`
- `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`
- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_coach_e2e.py -q`
- `backend\venv\Scripts\python.exe -m py_compile backend\chains\coach_graph.py backend\tests\test_coach_e2e.py`
- `npm --prefix frontend test -- app/dashboard/activities/_components/activity-coach-insight-panel.test.tsx app/dashboard/activities/_components/activity-coach-panel.test.tsx`
- `npm --prefix frontend run lint -- --file app/dashboard/activities/_components/activity-coach-insight-panel.tsx --file app/dashboard/activities/_components/activity-coach-insight-panel.test.tsx --file app/dashboard/activities/[id]/page.tsx`
- `http://localhost:3000/dashboard/activities/__new__` returned 200 on the existing local dev server.
