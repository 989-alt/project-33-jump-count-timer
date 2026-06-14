# 단계 3 · UI/UX Design (Nike 브랜드)

## 브랜드 선택 근거
- 토픽 권장 = **Nike** (스포츠 카테고리).
- 핵심 시그너처:
  - 흑백 + 단일 `soft-cloud` 회색 + sale 빨간 액센트(PR 신기록 시만).
  - 모든 CTA = pill 모양(`rounded.lg` 30px).
  - 풀스크린 사진 대신 풀스크린 **숫자** — 96px 이상의 우람한 디스플레이 톤이 그대로 운동 카운터 메탑.
  - 카드 = flat, no shadow, 1px hairline divider만.

## 화면 구조

### 1. 메인 화면 (3 카드 영역, TV 가로 기준)
```
┌─────────────────────────────────────────────────────────┐
│  JUMP COUNT TIMER       ⠿ 음소거    ⠿ Export  ⠿ Import   │  ← utility-bar (36px)
├─────────────────────────────────────────────────────────┤
│                                                          │
│   [ 학생 선택 / 추가 ]      [ 시간 프리셋 ]                  │
│   ┌──────────────────┐    ┌─────────────────┐           │
│   │ ● 김민지 (현재)    │    │  15  30  60  180 │ 초         │
│   │ ○ 이서준          │    │  [임의 ____ 초 ]  │           │
│   │ ○ 박지우          │    └─────────────────┘           │
│   │ + 새 학생 추가      │                                  │
│   └──────────────────┘                                  │
│                                                          │
│              [   START  ]   ← button-primary (pill, 흑)   │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  반 PR 랭킹                                                │
│  ─────────────────────────────────────────────────────  │
│  ▸ 30초 부문   1. 김민지 42회   2. 박지우 38회   3. ...      │
│  ▸ 60초 부문   1. 이서준 75회   ...                         │
└─────────────────────────────────────────────────────────┘
```

### 2. 측정 화면 (풀스크린 카운터)
```
┌─────────────────────────────────────────────────────────┐
│ ← 취소                                                    │
│                                                          │
│                 김민지 · 30초                              │
│                                                          │
│                                                          │
│              ████  ██████  ████                          │  ← 30vw 이상 숫자
│              ████  ██████  ████                          │
│                                                          │
│                                                          │
│                 남은 시간 18초                              │  ← 24px caption
│                                                          │
│              [ 화면 어디든 탭 ] 또는 [ Space ]               │
└─────────────────────────────────────────────────────────┘
```

### 3. 결과 화면 (모달이 아닌 풀스크린, Nike "billboard" 톤)
```
┌─────────────────────────────────────────────────────────┐
│              김민지 · 30초                                 │
│                                                          │
│                  42 회                                    │  ← 96px Inter 700
│                                                          │
│              🏆 신기록!  이전 38회 → 42회                   │  ← sale red
│              (또는: 이전 PR 45회 · 갱신 아님)                │
│                                                          │
│       [ 다음 학생 ]      [ 다시 측정 ]                       │
└─────────────────────────────────────────────────────────┘
```

## 디자인 토큰 (Nike DESIGN.md 적용)

### Colors (사용 8종으로 제한)
- `--ink: #111111` — 텍스트·primary CTA bg
- `--canvas: #ffffff` — 페이지 bg, on-image text
- `--soft-cloud: #f5f5f5` — 카드 bg, secondary CTA, 입력 chip
- `--hairline: #cacacb` — 1px divider
- `--hairline-soft: #e5e5e5` — 더 약한 divider
- `--mute: #707072` — subtitle / 메타 텍스트
- `--sale: #d30005` — 신기록 표시(유일한 빨강)
- `--success: #007d48` — "측정 완료" 등 긍정 시그널(절제)

### Typography
- 디스플레이(카운터 숫자): `Inter, "Helvetica Neue", Arial, sans-serif`, weight 700, font-feature `"tnum"` (탭ular nums — 자릿수 흔들림 방지)
- 헤딩: 같은 패밀리, weight 500
- 본문: 같은 패밀리, weight 400
- 시스템 폰트만 — 외부 CDN 의존 X.

### Spacing (8px base)
- 4/8/12/18/24/30/48 — Nike 토큰 그대로.

### Components
- **button-primary** — `bg:#111`, `color:#fff`, `rounded:30px`, padding `16px 32px`, height 48px.
- **button-secondary** — `bg:#f5f5f5`, `color:#111`, 같은 형태.
- **chip-active** (학생/프리셋 선택) — `bg:#111 color:#fff rounded:30px`.
- **chip** — `bg:#fff color:#111 border:1px #cacacb rounded:30px`.

## 접근성
- 모든 인터랙티브 요소 최소 48×48px (Nike AAA 가이드).
- `focus-visible` 상태: 2px solid `#111` + 12px outer halo `#f5f5f5`.
- 카운터 숫자는 `aria-live="polite"` 영역. 결과 모달은 `role="status" aria-live="assertive"`.
- 키보드: Space=카운트, S=시작/정지, R=초기화, Esc=취소.
- `prefers-reduced-motion` 시 모션 0.
- 색 단독으로 정보 전달 X — "신기록"은 sale red + 아이콘(트로피 SVG) + 텍스트 3중.

## 사운드
- 시작 카운트다운: 800Hz 짧은 비프 3회 + 1200Hz 길게 1회.
- 종료: 1500Hz · 1200Hz 더블 비프.
- 모두 Web Audio API (오디오 파일 다운로드 X). 음소거 토글로 즉시 off.

## design.md vs ui-ux-pro-max 충돌
- 충돌 시 design.md(Nike) 우선이라는 단계3 규칙 적용.
- ui-ux-pro-max의 "no emoji icons" 규칙은 따른다 — 트로피·음소거 등은 SVG inline.
- "smooth transitions 150-300ms" 따름.
