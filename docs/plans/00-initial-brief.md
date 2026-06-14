# Day 33 · #033 점프 카운트 타이머 (체육)

## 토픽 원문
- **콘텐츠 주제·목표**: 30초·1분 동안 줄넘기·제자리 점프 횟수를 클릭 또는 스페이스바로 카운트. 즉석 PR(개인 최고기록) 보드.
- **포함 기능**:
  - 시간 프리셋(15·30·60·180초)
  - 스페이스바·터치 카운트
  - 학생별 PR 보드(로컬)
  - 큰 글자 풀스크린
- **배제 기능**: 카메라 자동 카운트, 외부 공유
- **기술 스택**: HTML/CSS/JS
- **저장 방식**: localStorage(PR) + JSON
- **AI 옵션**: ✕ (Gemini 미사용)
- **대상**: 3~6학년 · **환경**: TV
- **DESIGN.md**: **Nike** (스포츠)

## 구현 제약
- **스택**: 단일 `index.html` + vanilla CSS + vanilla JS. CDN 의존 0건.
- **Gemini**: 사용하지 않음 (AI 옵션 X).
- **저장**: 학생별 PR을 localStorage에 JSON으로. 이름/리스트 export·import 도 JSON.
- **개인정보**: 학생 이름은 로컬만, 외부 전송 금지.
- **반응형**: 교실 TV(1920×1080~) + 노트북·태블릿(1024~) 모두 가독.
- **접근성**: 4.5:1 대비, 큰 버튼(최소 48px), aria-label, focus state, 키보드 (Space=카운트, R=초기화, S=시작/정지).
- **사운드**: Web Audio API로 시작·종료 비프음. 음소거 토글.

## 디자인 브랜드 선택
- **Nike** — 토픽 권장과 일치 (스포츠/운동/체육).
- 흑백 + 단일 sale red 액센트, 풀스크린 시 96px Futura 톤의 우주적 카운터.
- 폰트 대체: 시스템 sans-serif (Helvetica/Arial fallback). 디스플레이는 Inter 700 + tight letter-spacing.
