# 04 · Fixes applied (cycle 1)

| Bug | Fix | Why |
|---|---|---|
| B1 mobile horizontal overflow | (1) `html, body { overflow-x: hidden }` global guard; (2) 모바일 미디어쿼리에서 utility-bar padding/gap 더 타이트, util-btn height 36px·padding 10px, brand font-size 12px, content/card padding 축소, 랭킹 행에서 `.when` 숨김. | overflow-x:hidden은 안전망. 동시에 실제 폭 줄여 근본 원인도 제거. 랭킹 날짜는 모바일에선 부수 정보라 숨겨도 정보 손실 없음. |

다음 사이클: 재테스트.
