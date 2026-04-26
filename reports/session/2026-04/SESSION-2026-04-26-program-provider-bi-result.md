# SESSION-2026-04-26-program-provider-bi-result

## changed files
- `frontend/components/programs/program-provider-brand.tsx`
- `frontend/public/program-logos/work24.svg`
- `frontend/public/program-logos/kstartup.svg`
- `frontend/public/program-logos/sesac.svg`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made
- 사용자가 `/programs` 목록의 운영기관을 텍스트 대신 실제 BI 이미지로 보고 싶어 했다.
- 기존 배지는 텍스트 fallback만 있어 브랜드 식별성이 약했고, 표 UI 기준으로는 로고를 작게 고정해 넣는 편이 더 자연스러웠다.

## preserved behaviors
- 브랜드 매칭이 안 되는 기관은 기존 텍스트 fallback 배지를 그대로 유지한다.
- 프로그램 목록 테이블 구조와 열 배치는 바꾸지 않았다.
- 외부 API나 DB 스키마는 건드리지 않았다.

## risks / possible regressions
- `K-Startup`, `SeSAC`는 현재 row 높이에 맞춘 소형 SVG 자산이라, 원본 홍보물 비율과 완전히 같지는 않을 수 있다.
- 운영기관 문자열이 예상과 다르게 들어오면 브랜드 매칭이 실패하고 fallback 텍스트 배지로 내려갈 수 있다.

## follow-up refactoring candidates
- 운영기관 문자열 정규화 helper를 공용화해서 landing/list/detail이 같은 BI 매칭 기준을 쓰게 만들기
- 필요 시 `서울시`, `창업진흥원` 등 추가 운영기관 BI도 같은 자산 레지스트리로 확장하기
