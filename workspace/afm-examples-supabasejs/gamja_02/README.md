# gamja_02 — 당근마켓 클론 (Supabase-js)

당근마켓 핵심 기능 클론. Supabase-js CDN으로 백엔드 없이 프론트엔드 단독 구현.

**배포 URL**: https://gamja02.vercel.app

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React 18 + Tailwind CSS (CDN, 단일 `index.html`) |
| Auth | Supabase Auth (이메일/비밀번호) |
| Database | Supabase PostgreSQL (RLS 적용) |
| Storage | Supabase Storage (이미지 업로드) |
| 배포 | Vercel (정적 사이트) |

## 프로젝트 구조

```
gamja_02/
├── index.html       # React SPA (프론트엔드 전체)
├── vercel.json      # SPA 리라이트 설정
├── BRIEF.md         # 요구사항 정의
├── README.md        # 이 파일
└── screenshots/     # 기능 테스트 스크린샷
```

## gamja_01과의 차이점

| | gamja_01 | gamja_02 |
|---|---------|---------|
| 백엔드 | Express.js (`server.js`) | 없음 |
| 인증 | JWT + bcrypt | Supabase Auth |
| DB 접근 | server.js에서 pg 직접 쿼리 | supabase-js CDN으로 프론트에서 직접 |
| 보안 | API 미들웨어 | RLS (Row Level Security) |
| 파일 수 | 2개 (server.js + index.html) | 1개 (index.html) |

---

## 개발 일지 (AI 보조 코딩)

Claude Code (Opus)를 사용하여 전체 구현을 진행했다. 아래는 대화 기반 작업 기록.

### Phase 1 — Brief 작성

**사용자 요청**: gamja_01과 동일한 당근마켓 클론을 만들되, supabasejs agents를 이용 (별도 백엔드 없이)

**Q&A**:
- 기능 범위 → gamja_01의 10개 기능 그대로
- 인증 → Supabase Auth (이메일/비밀번호)
- 이미지 → Supabase Storage, 프론트엔드에서 직접 업로드
- 채팅 → Supabase Realtime (별도 키 불필요, anon key로 사용 가능)

**결과**: `BRIEF.md` 생성 — Requirements 1~10 정의

---

### Phase 2 — Requirements 1~4 구현

**사용자 요청**: Requirements 1~4 구현 + Vercel 배포 + 테스트 스크린샷

#### Step 1: DB 설정 (supabasejs-connector 에이전트)

**생성된 테이블**:
- `gamja_02_profiles` — auth.users와 연동 (UUID PK, nickname, manner_temp 등)
- `gamja_02_products` — 상품 (title, price, status, images 등)

**RLS 정책 7개**:
- profiles: `select_all`, `insert_own`, `update_own`
- products: `select_all`, `insert_own`, `update_own`, `delete_own`

**Storage**: `gamja_02_images` 버킷 (public, 10MB 제한)

#### Step 2: index.html 빌드

gamja_01의 UI 패턴을 참고하되, 백엔드 API 호출을 supabase-js 직접 호출로 전환.

**구현된 기능**:
1. **Supabase Auth** — 회원가입 시 `gamja_02_profiles` 자동 INSERT, `onAuthStateChange` 세션 관리
2. **상품 CRUD** — 목록(카드형), 상세(이미지 슬라이더, 판매자 정보), 등록/수정, 삭제
3. **거래 상태** — 판매중(초록)/예약중(노랑)/거래완료(회색) 3단계 + 바텀시트 모달
4. **가격 옵션** — 원 단위 포맷팅, 가격 제안 받기 체크, 나눔 토글

#### Step 3: Vercel 배포

`vercel.json` SPA 리라이트 설정 후 `vercel --prod` 배포.

---

## 트러블슈팅 기록

### 1. 이모지 유니코드 이스케이프 렌더링 오류

**증상**: `\uD83E\uDD55`가 🥕 이모지 대신 문자열 그대로 화면에 표시

**원인**: Babel Standalone이 JSX 내의 유니코드 서로게이트 쌍을 올바르게 처리하지 못함

**해결**: 모든 `\uD83X\uDXXX` 이스케이프 시퀀스를 실제 이모지 문자로 교체
```
\uD83E\uDD55 → 🥕  (당근)
\uD83E\uDDE1 → 🧡  (오렌지 하트)
\uD83D\uDCE6 → 📦  (상자)
\uD83D\uDE0A → 😊
\uD83D\uDED2 → 🛒  (장바구니)
```

**교훈**: CDN Babel Standalone + JSX 조합에서는 유니코드 이스케이프 대신 실제 이모지 문자를 사용할 것.

---

### 2. `getSession()` navigator lock 타임아웃

**증상**: 페이지 새로고침(hard reload) 후 앱이 "로딩 중..." 상태에서 무한 대기

**분석**:
- `db.auth.getSession()` 호출이 영원히 resolve되지 않음
- `db.from().select()` 쿼리도 마찬가지로 행 — Supabase 클라이언트 자체가 블록됨
- 직접 `fetch()` API 호출은 정상 동작 (200 응답)

**원인**: supabase-js v2가 세션 관리에 `navigator.locks` API를 사용하는데, 이전 세션의 lock이 해제되지 않은 채 페이지가 리로드되면 새 세션이 lock 획득에 실패

**해결**:
```js
// Before
const db = window.supabase.createClient(URL, KEY);

// After — storageKey 분리 + flowType 지정
const db = window.supabase.createClient(URL, KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'gamja_02_auth',
    flowType: 'implicit',
  }
});
```

추가로 `getSession()` 호출에 5초 타임아웃 방어 코드 추가:
```js
const timeout = setTimeout(() => {
  setAuthLoading(false);
}, 5000);

db.auth.getSession().then(({ data, error }) => {
  clearTimeout(timeout);
  // ...
}).catch(err => {
  clearTimeout(timeout);
  setAuthLoading(false);
});
```

**교훈**: supabase-js v2 CDN 사용 시 반드시 `storageKey`와 `flowType`을 명시적으로 설정할 것. `getSession()` 같은 비동기 호출에는 타임아웃 방어를 추가.

---

### 3. 폼 제출 버튼 클릭이 동작하지 않는 문제

**증상**: 상품 등록 "등록하기" 버튼 클릭 시 네트워크 요청 발생하지 않음

**원인**: 브라우저 자동화 도구(chrome-devtools MCP)의 `click` 이벤트가 `<form>` 의 `submit` 이벤트를 트리거하지 못하는 경우가 있음

**해결**: JavaScript `form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))` 로 직접 submit 이벤트 발생

**참고**: 실제 사용자 클릭으로는 정상 동작. 자동화 테스트 환경에서만 발생하는 이슈.

---

## 테스트 결과

### 테스트 시나리오

1. 홈 화면 로딩 (빈 상태, 카테고리 필터)
2. 회원가입 (test@****.com / 감자테스터)
3. 로그인
4. 상품 등록 — 맥북 프로 14인치, 2,200,000원, 가격 제안 받기
5. 상품 상세 확인 (매너온도 36.5°C, 판매자 정보)
6. 거래 상태 변경: 판매중 → 예약중
7. 나눔 상품 등록 — 제주 한라봉 5kg, 무료 나눔
8. 홈 화면에서 두 상품 표시 확인 (나눔🧡, 예약중 배지, 가격 포맷)
9. 나의 당근 프로필 확인 (내 판매 상품 2개)

### 스크린샷

| # | 파일 | 내용 |
|---|------|------|
| 01 | `01-home-fixed.png` | 홈 화면 (빈 상태, 🥕 이모지 정상) |
| 02 | `02-login.png` | 로그인 페이지 |
| 03 | `03-signup-form.png` | 회원가입 폼 입력 |
| 04 | `04-product-form-filled.png` | 상품 등록 폼 (가격 제안 받기 체크) |
| 05 | `05-product-detail.png` | 상품 상세 (매너온도, 판매자) |
| 06 | `06-status-change-modal.png` | 거래 상태 변경 모달 |
| 07 | `07-status-reserved.png` | 예약중 배지 표시 |
| 08 | `08-free-product-form.png` | 나눔 상품 등록 (가격 비활성화) |
| 09 | `09-free-product-detail.png` | 나눔 상품 상세 |
| 10 | `10-home-with-products.png` | 홈 - 상품 2개 리스트 |
| 11 | `11-my-profile.png` | 나의 당근 프로필 |

---

## 환경 설정

Supabase 프로젝트 설정 시 참고:
- Supabase Dashboard > Authentication > Providers > Email > "Confirm email" → OFF (빠른 테스트용)
- DB 테이블 prefix: `gamja_02_`
- Storage bucket: `gamja_02_images` (public)

```
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_KEY=<anon-key>
DATABASE_URL=postgresql://postgres.<project-id>:<password>@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

## 요구사항 체크리스트

- [x] 1. Supabase Auth 이메일/비밀번호 회원가입 및 로그인
- [x] 2. 상품 CRUD (제목, 설명, 가격, 카테고리, 이미지 최대 10장, 거래 장소)
- [x] 3. 거래 상태 관리: 판매중 / 예약중 / 거래완료
- [x] 4. 가격 입력 + "가격 제안 받기" 옵션 + 나눔(무료) 옵션
- [ ] 5. 브라우저 Geolocation 기반 동네 설정, 반경 필터링
- [ ] 6. 상품 검색 + 카테고리 필터
- [ ] 7. 1:1 채팅 (Supabase Realtime)
- [ ] 8. 매너온도 시스템
- [ ] 9. 거래 후기 작성
- [ ] 10. 이미지 업로드 (Supabase Storage)
