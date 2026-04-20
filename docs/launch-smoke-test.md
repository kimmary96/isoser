# Launch Smoke Test

런칭 직전이나 주요 리팩토링 직후에 빠르게 확인할 핵심 사용자 시나리오 체크리스트입니다.

## 1. 기본 검증 명령

- `cd frontend && npm run lint`
- `cd frontend && npx tsc -p tsconfig.codex-check.json --noEmit`
- `cd frontend && npm run build`
- `backend\venv\Scripts\python.exe -m pytest backend/tests tests -q`

## 2. 공개 진입 시나리오

- `/` 접속 시 `/landing-a`로 정상 이동하는지 확인
- `/landing-a` 상단 헤더의 `프로그램 탐색`, `비교`, `워크스페이스` 링크 동작 확인
- `/programs`에서 기본 정렬이 마감 임박순인지 확인
- `/programs`에서 `마감된 활동 보기` 토글 동작 확인
- `/compare`에서 최대 3개 슬롯 추가/제거가 정상 동작하는지 확인

## 3. 로그인 / 인증 시나리오

- `/login`에서 Google 로그인 시작이 정상 동작하는지 확인
- 기존 사용자 로그인 후 기본 진입이 `/landing-a` 또는 원래 `next` 경로인지 확인
- 신규 사용자가 `/onboarding`으로 분기되는지 확인
- 비로그인 상태에서 `/dashboard` 접근 시 `/login?redirectedFrom=...`로 이동하는지 확인

## 4. 프로필 / 문서 시나리오

- `/dashboard/profile` 진입 및 프로필 조회 확인
- 프로필 기본 정보 저장 확인
- 프로필 이미지 업로드 정상 동작 확인
- 비정상 파일 업로드 시 오류 메시지 확인
- `/dashboard/resume` 진입 및 기존 이력서 불러오기 확인
- `/dashboard/resume/export` 진입 및 PDF export 확인

## 5. 활동 저장소 시나리오

- `/dashboard/activities` 목록 조회 확인
- 새 활동 생성 후 저장 확인
- 활동 이미지 업로드 확인
- 손상/위장 이미지 업로드 차단 확인
- 활동 수정 및 삭제 확인

## 6. AI 기능 시나리오

- `/dashboard/match`에서 공고 분석 요청 확인
- `/dashboard/cover-letter` 또는 코칭 경로에서 AI 코칭 요청 확인
- `/api/summary` 사용 화면에서 요약 생성 확인
- 짧은 시간에 반복 요청 시 `429` 제한 동작 확인
- 백엔드 응답 지연 시 timeout 오류가 사용자 메시지로 보이는지 확인

## 7. 프로그램 추천 / 비교 시나리오

- 추천 프로그램 카드 로딩 확인
- 캘린더 추천 로딩 확인
- 로그인 상태에서 compare relevance 계산 확인
- compare relevance 반복 요청 시 `429` 제한 동작 확인

## 8. 로그 / 운영 확인

- 실패 상황에서 서버 로그에 JSON 구조 로그가 남는지 확인
- 로그에 토큰, 전체 요청 본문, 비밀번호 같은 민감정보가 없는지 확인
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`이 있으면 분산 rate limiting이 동작하는지 확인
- Upstash 미설정 환경에서도 메모리 fallback으로 정상 동작하는지 확인

## 9. 현재 의도적 보류 항목

- `frontend/app/dashboard/profile/_components/profile-edit-modal.tsx`
  - blob preview를 사용하므로 `<img>` 경고 1건은 현재 의도적으로 유지
- 외부 안티바이러스 엔진 연동
  - 현재는 파일 헤더와 이미지 메타데이터 검증까지 적용
  - 완전한 바이러스 스캔은 별도 인프라 연동 필요
