# Program Detail Visual QA Result

## 비교 기준

- 기준 시안: `C:\Users\User\Downloads\isoser-program-detail.html`
- 현재 구현 확인 URL: `http://localhost:3005/programs/4615a084-2e06-4840-98cd-b2092d8f715b`
- 사용 데이터: 실제 백엔드 `GET /programs/{id}/detail` 응답

## 확인한 문제

- 첫 구현은 실제 데이터 렌더링은 정상이나, 시안 대비 상단 티커/브레드크럼/히어로 배경 구조가 약했다.
- 섹션 카드 헤더가 시안보다 밋밋해 섹션 구분과 시각적 위계가 약했다.
- 우측 신청 카드의 상단 색감이 시안의 인디고 계열보다 너무 검정에 가까웠다.

## 개선 내용

- 실제 프로그램 `title`, `provider`, `location`만 사용한 상단 티커를 추가했다.
- 상세 페이지 상단을 `이소서 / 프로그램 허브 / 현재 프로그램명` 브레드크럼 구조로 정리했다.
- Hero 영역에 시안과 유사한 은은한 radial 배경과 grid texture를 추가했다.
- 섹션 카드 헤더에 작은 아이콘 블록을 추가해 시안의 섹션 위계를 더 가깝게 맞췄다.
- 우측 신청 카드와 CTA 색상을 인디고 톤으로 조정했다.

## 검증 결과

- `npm --prefix frontend run lint -- --file "app/(landing)/programs/[id]/page.tsx" --file "app/(landing)/programs/[id]/program-detail-client.tsx"` 통과
- `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit` 통과
- 브라우저 확인: error overlay 없음
- 주요 UI 확인: `프로그램 요약`, `신청 페이지 바로가기` 렌더링 확인
- 모바일 390px 확인: `NO_HORIZONTAL_OVERFLOW`

## 캡처 파일

- 기준 시안: `reports\visual-qa\program-detail\program-detail-reference-desktop.png`
- 개선 전/상태 확인: `reports\visual-qa\program-detail\program-detail-current-state.png`
- 개선 후 데스크톱: `reports\visual-qa\program-detail\program-detail-current-improved-desktop.png`
- 개선 후 모바일: `reports\visual-qa\program-detail\program-detail-current-improved-mobile.png`

## 남은 차이

- 시안의 AI 매칭 배너, 후기, FAQ, 커리큘럼, 유사 프로그램은 현재 실제 상세 API 데이터가 없어 추가하지 않았다.
- 시안은 예시 데이터가 풍부한 상세 페이지이고, 현재 운영 데이터는 sparse data라 섹션 수가 더 적게 보이는 것이 정상이다.
- 데이터 계약이 추가되면 해당 섹션을 실제 데이터 기반으로 다시 확장할 수 있다.

