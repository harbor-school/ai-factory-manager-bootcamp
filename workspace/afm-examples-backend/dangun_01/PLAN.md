# 당근마켓 클론 (dangun_01) - 구현 계획

## 프로젝트 개요

당근마켓의 핵심 기능을 클론한 중고거래 플랫폼.
기존 `todo_app_01` 패턴(Express + PostgreSQL + JWT + 단일 HTML 프론트엔드)을 따른다.

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Express.js (Node.js) |
| Database | PostgreSQL (Neon/Supabase) |
| Auth | JWT + bcryptjs |
| Frontend | 단일 index.html (Vanilla JS + Tailwind CDN) |
| 배포 | Vercel (서버리스) |

---

## 구현 단계 (총 6단계)

### Phase 1. 프로젝트 초기 세팅 + 인증 시스템

**목표:** 프로젝트 뼈대와 회원가입/로그인 완성

**Backend:**
- `package.json` 생성 (express, pg, bcryptjs, jsonwebtoken, multer)
- `server.js` 기본 구조 (Express 앱, DB Pool, lazy init)
- DB 테이블: `dangun_users`
  ```sql
  id SERIAL PRIMARY KEY
  username VARCHAR(50) UNIQUE NOT NULL
  password VARCHAR(255) NOT NULL
  nickname VARCHAR(50) NOT NULL
  location VARCHAR(100) DEFAULT '서울시 강남구'
  profile_image TEXT
  created_at TIMESTAMP DEFAULT NOW()
  ```
- API 엔드포인트:
  - `POST /api/auth/register` - 회원가입
  - `POST /api/auth/login` - 로그인
  - `GET /api/auth/me` - 내 정보 조회
  - `PUT /api/auth/profile` - 프로필 수정 (닉네임, 동네)
- JWT 인증 미들웨어

**Frontend:**
- 로그인/회원가입 화면 (모달 또는 페이지)
- 닉네임 + 동네 설정

**완료 기준:** 회원가입 → 로그인 → 토큰 저장 → 인증된 요청 가능

---

### Phase 2. 상품 CRUD (핵심 기능)

**목표:** 중고 물품 등록/조회/수정/삭제

**Backend:**
- DB 테이블: `dangun_products`
  ```sql
  id SERIAL PRIMARY KEY
  user_id INTEGER NOT NULL REFERENCES dangun_users(id)
  title VARCHAR(200) NOT NULL
  description TEXT
  price INTEGER NOT NULL DEFAULT 0
  category VARCHAR(50)
  location VARCHAR(100)
  image_url TEXT
  status VARCHAR(20) DEFAULT '판매중'   -- 판매중 | 예약중 | 판매완료
  view_count INTEGER DEFAULT 0
  created_at TIMESTAMP DEFAULT NOW()
  updated_at TIMESTAMP DEFAULT NOW()
  ```
- API 엔드포인트:
  - `POST /api/products` - 상품 등록 (auth)
  - `GET /api/products` - 상품 목록 (필터: category, status, keyword, location)
  - `GET /api/products/:id` - 상품 상세 (조회수 +1)
  - `PUT /api/products/:id` - 상품 수정 (본인만)
  - `DELETE /api/products/:id` - 상품 삭제 (본인만)
  - `PATCH /api/products/:id/status` - 상태 변경 (판매중→예약중→판매완료)

**Frontend:**
- 홈 화면: 상품 카드 리스트 (이미지, 제목, 동네, 가격, 시간)
- 상품 등록 폼 (제목, 가격, 카테고리, 설명, 이미지 URL)
- 상품 상세 페이지 (판매자 정보, 상태 배지, 가격)
- 카테고리 필터, 검색

**완료 기준:** 상품 등록 → 목록에 표시 → 상세 보기 → 수정/삭제 가능

---

### Phase 3. 관심(좋아요) + 내 상점

**목표:** 관심 기능과 사용자별 상품 모아보기

**Backend:**
- DB 테이블: `dangun_likes`
  ```sql
  id SERIAL PRIMARY KEY
  user_id INTEGER NOT NULL REFERENCES dangun_users(id)
  product_id INTEGER NOT NULL REFERENCES dangun_products(id)
  created_at TIMESTAMP DEFAULT NOW()
  UNIQUE(user_id, product_id)
  ```
- API 엔드포인트:
  - `POST /api/products/:id/like` - 관심 토글 (auth)
  - `GET /api/products/:id/like` - 관심 여부 확인
  - `GET /api/my/likes` - 내 관심 목록
  - `GET /api/my/products` - 내 판매 목록
  - `GET /api/users/:id/products` - 특정 사용자 판매 목록
- 상품 목록 API에 `like_count` 필드 추가

**Frontend:**
- 상품 카드/상세에 하트(관심) 버튼
- 하단 탭 네비게이션: 홈 | 관심목록 | 내 상점 | 프로필
- 내 상점 페이지 (판매중/판매완료 탭)
- 관심목록 페이지

**완료 기준:** 좋아요 토글 → 관심목록 확인 → 내 상점에서 내 상품 관리

---

### Phase 4. 채팅 시스템

**목표:** 구매자-판매자 간 1:1 채팅

**Backend:**
- DB 테이블: `dangun_chat_rooms`
  ```sql
  id SERIAL PRIMARY KEY
  product_id INTEGER NOT NULL REFERENCES dangun_products(id)
  buyer_id INTEGER NOT NULL REFERENCES dangun_users(id)
  seller_id INTEGER NOT NULL REFERENCES dangun_users(id)
  created_at TIMESTAMP DEFAULT NOW()
  UNIQUE(product_id, buyer_id)
  ```
- DB 테이블: `dangun_chat_messages`
  ```sql
  id SERIAL PRIMARY KEY
  room_id INTEGER NOT NULL REFERENCES dangun_chat_rooms(id)
  sender_id INTEGER NOT NULL REFERENCES dangun_users(id)
  message TEXT NOT NULL
  created_at TIMESTAMP DEFAULT NOW()
  ```
- API 엔드포인트:
  - `POST /api/chat/rooms` - 채팅방 생성 (product_id 기반)
  - `GET /api/chat/rooms` - 내 채팅방 목록
  - `GET /api/chat/rooms/:id/messages` - 메시지 조회
  - `POST /api/chat/rooms/:id/messages` - 메시지 전송

**Frontend:**
- 상품 상세에서 "채팅하기" 버튼 → 채팅방 진입
- 채팅 목록 화면 (최근 메시지 미리보기)
- 채팅 상세 화면 (메시지 버블 UI, 폴링으로 새 메시지 확인)
- 하단 탭에 채팅 추가: 홈 | 채팅 | 관심목록 | 내 상점 | 프로필

**완료 기준:** 상품에서 채팅 시작 → 메시지 주고받기 → 채팅 목록 확인

---

### Phase 5. 이미지 업로드 + UI 다듬기

**목표:** 실제 이미지 업로드, 모바일 반응형 UI 완성

**Backend:**
- `multer` 를 이용한 이미지 업로드 (Base64 또는 메모리 저장 → DB TEXT 필드)
- `POST /api/upload` - 이미지 업로드 API
- 또는: 외부 이미지 호스팅 (imgur API 등) 연동

**Frontend:**
- 상품 등록 시 이미지 파일 선택 + 미리보기
- 모바일 우선 반응형 레이아웃 (당근마켓 스타일)
- 빈 상태(empty state) 처리
- 로딩 스피너, 토스트 알림
- 상대 시간 표시 ("3분 전", "2시간 전")
- 가격 포맷팅 ("15,000원")

**완료 기준:** 이미지 포함 상품 등록 가능, 모바일에서 자연스러운 UI

---

### Phase 6. 배포 (Vercel)

**목표:** Vercel 서버리스 배포

**작업:**
- `vercel.json` 설정
  ```json
  {
    "version": 2,
    "builds": [{ "src": "server.js", "use": "@vercel/node" }],
    "routes": [{ "src": "/(.*)", "dest": "server.js" }]
  }
  ```
- 환경변수 설정 (`DATABASE_URL`, `JWT_SECRET`)
- Vercel 배포 및 동작 확인
- 최종 테스트 (회원가입 → 상품등록 → 채팅 → 관심)

**완료 기준:** 공개 URL에서 전체 기능 정상 동작

---

## 카테고리 목록 (당근마켓 기반)

| 코드 | 이름 |
|------|------|
| digital | 디지털기기 |
| furniture | 가구/인테리어 |
| kids | 유아동 |
| life | 생활/가공식품 |
| sports | 스포츠/레저 |
| women | 여성의류 |
| men | 남성의류 |
| game | 게임/취미 |
| beauty | 뷰티/미용 |
| pet | 반려동물용품 |
| book | 도서/티켓/음반 |
| plant | 식물 |
| etc | 기타 중고물품 |

---

## 파일 구조 (최종)

```
dangun_01/
├── server.js          # Express 서버 (API + 정적 파일)
├── index.html         # 단일 페이지 프론트엔드
├── package.json
├── vercel.json        # Vercel 배포 설정
└── PLAN.md            # 이 문서
```

---

## 권장 구현 순서 요약

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
 인증       상품CRUD   좋아요     채팅      이미지/UI   배포
 (기반)     (핵심)    (부가)    (소통)    (완성도)   (공개)
```

각 Phase 완료 후 로컬에서 동작 확인 → 다음 Phase 진행.
Phase 2까지 완료하면 MVP(최소 기능 제품)로 사용 가능.
