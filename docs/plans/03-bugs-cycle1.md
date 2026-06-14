# 03 · Bugs found in cycle 1

| # | Severity | Symptom | Repro | Expected | Actual |
|---|---|---|---|---|---|
| B1 | P2 | 모바일 뷰포트(390px)에서 가로 스크롤 발생 | iPhone 12 뷰포트로 메인 페이지 로드 | scrollWidth ≤ 뷰포트 | scrollWidth=413 (23px 초과) |

P0/P1 = 0건. B1만 해결 후 종료 가능.
