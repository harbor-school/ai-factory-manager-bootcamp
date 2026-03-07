# ecommerce_01 — 쿡웨어 스튜디오

요리 애호가 타깃 주방용품 쇼핑몰. 상품 탐색부터 토스페이먼츠 결제까지 풀 플로우를 구현한 프로젝트.

**배포 URL**: https://ecommerce01-khaki.vercel.app

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Express.js (단일 `server.js`) |
| Database | PostgreSQL (Supabase Transaction Pooler, port 6543) |
| Frontend | React 18 + Tailwind CSS (CDN, 단일 `index.html`) |
| 인증 | JWT (bcryptjs 해싱) |
| 결제 | TossPayments V1 Widget SDK |
| 이미지 | fal.ai 생성 → Supabase Storage 호스팅 |
| 배포 | Vercel Serverless (`@vercel/node`) |

## 프로젝트 구조

```
ecommerce_01/
├── server.js          # Express 서버 (API 전체)
├── index.html         # React SPA (프론트엔드 전체)
├── package.json
├── vercel.json
├── .env.example       # 환경변수 템플릿
├── .env.local         # 실제 환경변수 (git 미추적)
├── BRIEF.md           # 요구사항 정의
├── README.md          # 이 파일
└── screenshots/       # 기능 테스트 스크린샷
    ├── 01-main-page.png
    ├── 02-category-filter.png
    ├── ...
    └── 12-order-complete.png
```

## 환경변수

`.env.example` 참조. 실제 값은 `.env.local`에 설정.

```
DATABASE_URL=postgresql://user:****@host:6543/postgres
JWT_SECRET=****
TOSS_SECRET_KEY=test_gsk_****
KAKAO_REST_API_KEY=****
KAKAO_CLIENT_SECRET=****
KAKAO_REDIRECT_URI=http://localhost:3000/api/auth/kakao/callback
```

---

## 개발 일지 (AI 보조 코딩)

Claude Code (Opus)를 사용하여 전체 구현을 진행했다. 아래는 세션별 작업 기록.

### Session 1 — MVP 구현 (요구사항 1~3, 8~10)

**목표**: 기본 쇼핑몰 골격 구현 + Vercel 배포

**구현 내용**:
- 이메일/비밀번호 회원가입·로그인 (JWT 인증)
- 상품 목록 페이지 — 3개 카테고리 필터 (칼/도마류, 냄비/팬류, 주방소품류)
- 상품 상세 페이지 — 이미지, 이름, 가격(원화), 설명
- 시드 데이터 15개 상품 (3카테고리 x 5상품, 가격대 1.2만~14.9만원)
- fal.ai로 상품 이미지 15장 생성 → Supabase Storage 업로드
- Vercel 배포 완료

**스크린샷**:
| # | 파일 | 내용 |
|---|------|------|
| 01 | `01-main-page.png` | 메인 상품 목록 |
| 02 | `02-category-filter.png` | 카테고리 필터 동작 |
| 03 | `03-product-detail.png` | 상품 상세 |
| 04 | `04-register-page.png` | 회원가입 페이지 |
| 05 | `05-logged-in-home.png` | 로그인 후 메인 |
| 07 | `07-real-images-home.png` | AI 생성 이미지 적용 메인 |
| 08 | `08-product-detail-real-image.png` | AI 생성 이미지 적용 상세 |

---

### Session 2 — 장바구니 + 결제 구현 (요구사항 4~7)

**목표**: 장바구니, 주문서, 토스페이먼츠 결제, 주문 내역

#### 구현 전략

서버와 프론트엔드를 **병렬로** 구현 (두 개의 에이전트 동시 실행):
- **Backend Agent**: authMiddleware, cart/orders/order_items 테이블, Cart CRUD API, Order API, TossPayments 결제 승인 API
- **Frontend Agent**: CartPage, CheckoutPage, OrderCompletePage, OrdersPage, 헤더 카트 뱃지, hash 기반 라우팅

#### 주요 API 엔드포인트

```
# 인증
POST   /api/register        — 회원가입
POST   /api/login           — 로그인

# 상품 (Public)
GET    /api/products         — 상품 목록 (?category= 필터)
GET    /api/products/:id     — 상품 상세

# 장바구니 (인증 필요)
GET    /api/cart             — 장바구니 조회
GET    /api/cart/count       — 카트 뱃지 카운트
POST   /api/cart             — 상품 추가 (upsert)
PATCH  /api/cart/:id         — 수량 변경
DELETE /api/cart/:id         — 상품 삭제

# 주문 (인증 필요)
POST   /api/orders           — 주문 생성 (장바구니 → 주문)
GET    /api/orders           — 주문 내역
GET    /api/orders/:id       — 주문 상세

# 결제
POST   /api/payments/confirm — 토스페이먼츠 결제 승인
```

#### 프론트엔드 라우팅 (Hash Router)

```
#/             — 메인 (상품 목록)
#/product/:id  — 상품 상세
#/register     — 회원가입
#/login        — 로그인
#/cart         — 장바구니
#/checkout     — 주문서 + 결제
#/order-complete — 주문 완료
#/orders       — 주문 내역
```

---

## 트러블슈팅 기록

### 1. TossPayments SDK 버전 호환 문제

**증상**: 결제 위젯이 로드되지 않고 콘솔에 401 에러 또는 "API 개별 연동 키는 지원하지 않습니다" 에러 발생

**시도한 것들**:
1. API 개별 연동 키(`test_ck_***`)로 위젯 SDK 초기화 → "결제위젯 연동 키의 클라이언트 키로 SDK를 연동해주세요" 에러
2. 위젯 클라이언트 키(`test_gck_***`)로 V2 SDK(`/v2/standard`) 초기화 → 401 에러
3. 공식 GitHub 샘플(`tosspayments/payment-widget-sample`)에서 정확한 테스트 키 확인 → 여전히 V2에서 401

**원인**: V2 SDK(`/v2/standard`)는 토스페이먼츠 공식 문서의 테스트 위젯 키와 호환되지 않음

**해결**: V1 SDK로 전환
```html
<!-- V2 (동작 안 함) -->
<script src="https://js.tosspayments.com/v2/standard"></script>

<!-- V1 (동작함) -->
<script src="https://js.tosspayments.com/v1/payment-widget"></script>
```

V1 API 사용법:
```js
const widget = PaymentWidget(clientKey, customerKey);
widget.renderPaymentMethods('#payment-method', { value: amount });
widget.renderAgreement('#agreement');
widget.requestPayment({ orderId, orderName, ... });
```

**교훈**: 토스페이먼츠 테스트 환경에서는 반드시 V1 Widget SDK를 사용할 것. V2 SDK는 별도의 키 발급이 필요할 수 있음.

---

### 2. DATABASE_URL 환경변수 불일치

**증상**: 로컬에서는 정상 동작하는데 Vercel 배포 후 주문 생성 시 500 에러

**원인**:
- `server.js`에 하드코딩된 fallback DB 주소와 Vercel 환경변수 `DATABASE_URL`이 **서로 다른 Supabase 프로젝트**를 가리키고 있었음
- Vercel에서는 `process.env.DATABASE_URL`이 우선 적용되어 잘못된 DB에 연결
- 잘못된 DB에는 `ecommerce_01_orders` 테이블이 다른 스키마로 이미 존재

**해결**:
1. Vercel 환경변수 `DATABASE_URL`을 올바른 Supabase 프로젝트 주소로 수정 (production + development 모두)
2. 재배포 → `initDB()`가 올바른 DB에 테이블 생성

**교훈**:
- `CREATE TABLE IF NOT EXISTS`는 기존 테이블의 스키마를 변경하지 않음 — 컬럼이 다르면 직접 DROP 후 재생성 필요
- Vercel 환경변수와 코드 내 fallback 값이 다른 DB를 가리킬 수 있으므로, 배포 전 `vercel env pull`로 반드시 확인

---

### 3. TossPayments 테스트 키 오타

**증상**: 올바른 형식의 위젯 키인데도 401 에러

**원인**: 클라이언트 키 문자열에 오타 — 한 글자 차이(`W23n` vs `W43n`)

**해결**: 토스페이먼츠 공식 GitHub 샘플 저장소에서 정확한 키 복사
- 레포: `tosspayments/payment-widget-sample`
- 파일: `payment-widget/node-vanillajs/public/checkout.html`

**교훈**: 테스트 키는 반드시 공식 샘플 코드에서 복사할 것. 문서 페이지의 키가 최신이 아닐 수 있음.

---

## 테스트 결과

### 전체 결제 플로우 검증 (Session 2)

1. 회원가입 (테스트 계정 생성)
2. 로그인
3. 상품 장바구니 담기 (다마스커스 셰프 나이프 89,000원)
4. 장바구니 페이지 — 수량 변경, 합계 확인
5. 주문서 작성 — 배송지 입력
6. 토스페이먼츠 위젯 렌더링 확인
7. 테스트 결제 실행 (테스트 비밀번호 사용)
8. 결제 승인 → 주문 완료 페이지 표시
9. 장바구니 비워짐 확인

**스크린샷 (Session 2)**:
| # | 파일 | 내용 |
|---|------|------|
| 08 | `08-main-with-cart-header.png` | 카트 아이콘이 있는 메인 헤더 |
| 09 | `09-cart-page.png` | 장바구니 (상품 3개, 합계 표시) |
| 10 | `10-checkout-page-with-tosspayments.png` | 주문서 + 토스페이먼츠 위젯 |
| 11 | `11-tosspayments-confirm.png` | 89,000원 결제 확인 다이얼로그 |
| 12 | `12-order-complete.png` | 주문 완료 성공 |

---

## 로컬 실행

```bash
# 환경변수 설정
cp .env.example .env.local
# .env.local 에 실제 값 입력

# 의존성 설치
npm install

# 서버 실행
npm start
# → http://localhost:3000
```

## 요구사항 체크리스트

- [x] 1. 이메일+비밀번호 회원가입/로그인 (JWT 인증)
- [x] 2. 상품 목록 페이지 — 카테고리 필터, 15개 상품
- [x] 3. 상품 상세 페이지 — 이미지, 이름, 가격, 설명, 장바구니 담기
- [x] 4. 장바구니 — DB 저장, 수량 변경/삭제, 합계 표시
- [x] 5. 주문서 — 배송지 입력 후 토스페이먼츠 결제 위젯 연동
- [x] 6. 토스페이먼츠 테스트 키로 실제 결제 플로우 동작
- [x] 7. 주문 완료 및 주문 내역 조회
- [x] 8. 시드 데이터: 3카테고리 x 5상품 = 15개
- [x] 9. 상품 이미지: fal.ai 생성 → Supabase Storage 업로드
- [x] 10. Vercel 배포 후 접근 가능한 URL 확보

---

## 커밋 히스토리

```
12aba77 feat(ecommerce_01): 장바구니, 주문서, 토스페이먼츠 결제, 주문 내역 구현
9790afc feat(ecommerce_01): 주방용품 쇼핑몰 MVP 구현 및 Vercel 배포
```
