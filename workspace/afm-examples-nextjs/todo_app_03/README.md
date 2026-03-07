# Todo App 03 - Next.js 미니멀 할 일 관리

배포 URL: https://todoapp03.vercel.app

## 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Auth**: JWT (jose + bcryptjs), httpOnly Cookie + Middleware
- **DB**: PostgreSQL (Supabase Pooler)
- **Styling**: Tailwind CSS 3
- **Deploy**: Vercel

## 주요 기능

- 회원가입 / 로그인 / 로그아웃
- 미인증 사용자는 자동으로 로그인 페이지로 리다이렉트
- 할 일 추가 / 완료 토글 / 삭제 (CRUD)
- 완료 카운터 (n/m 완료)

## 프로젝트 구조

```
todo_app_03/
├── app/
│   ├── layout.js              # 루트 레이아웃
│   ├── page.js                # 메인 Todo 페이지 (보호됨)
│   ├── globals.css            # Tailwind CSS
│   ├── login/page.js          # 로그인 페이지
│   ├── register/page.js       # 회원가입 페이지
│   └── api/
│       ├── auth/
│       │   ├── register/route.js
│       │   ├── login/route.js
│       │   ├── logout/route.js
│       │   └── me/route.js
│       └── todos/
│           ├── route.js       # GET(목록), POST(생성)
│           └── [id]/route.js  # PATCH(토글), DELETE(삭제)
├── lib/
│   ├── db.js                  # PostgreSQL 커넥션 풀 + 테이블 자동 생성
│   └── auth.js                # JWT 발급/검증 유틸
├── middleware.js               # 라우트 보호 (비로그인 → /login)
└── screenshots/               # 기능 테스트 스크린샷
```

## DB 테이블

테이블 prefix: `todo_app_03_`

```sql
todo_app_03_users (id, name, email, password_hash, created_at)
todo_app_03_todos (id, user_id, title, completed, created_at)
```

## 환경변수

```
DATABASE_URL=postgresql://user:password@host:6543/postgres
JWT_SECRET=your-jwt-secret-key
```

## 스크린샷

| # | 화면 | 파일 |
|---|------|------|
| 1 | 로그인 페이지 | `screenshots/01_login_page.png` |
| 2 | 회원가입 페이지 | `screenshots/02_register_page.png` |
| 3 | 회원가입 폼 입력 | `screenshots/03_register_filled.png` |
| 4 | 빈 할일 목록 (로그인 직후) | `screenshots/04_empty_todos.png` |
| 5 | 할 일 4개 추가 | `screenshots/05_todos_added.png` |
| 6 | 할 일 완료 토글 (2/4) | `screenshots/06_todos_completed.png` |
| 7 | 로그아웃 → 로그인 화면 | `screenshots/07_logged_out.png` |

---

## 구현 로그 (Claude Code 채팅 내역)

### 1. 프로젝트 생성 요청

**사용자:**
> workspace/afm-examples-nextjs/todo_app_03 여기에 미니멀한 todo 앱 만들어줘
> nextjs 로 만들어줘
> 1. 로그인한 유저만 사용할 수 있어
> 2. env - db 주소: postgresql://***@aws-1-us-east-1.pooler.supabase.com:6543/postgres, 테이블 prefix: todo_app_03
> 3. vercel 에 배포하고, 주요 기능들 테스트 해서 스크린샷으로 저 폴더에 남겨줘

### 2. 기존 워크스페이스 구조 분석

Claude가 기존 프로젝트들(todo_app_01, todo_app_02, gamja_01 등)의 패턴을 분석:
- npm 패키지 매니저 사용
- PostgreSQL + Supabase Pooler (SSL 필수)
- JWT 인증 패턴
- Vercel 배포 컨벤션
- 테이블 prefix 네이밍 (`project_name_tablename`)
- Lazy DB init 패턴 (CREATE TABLE IF NOT EXISTS)

### 3. 프로젝트 파일 생성

총 16개 파일을 생성:

**설정 파일:** package.json, next.config.js, jsconfig.json, tailwind.config.js, postcss.config.js, .gitignore, .env.local

**백엔드:**
- `lib/db.js` - pg Pool, SSL, max:3 (serverless 최적화), lazy table init
- `lib/auth.js` - jose 기반 JWT signToken/verifyToken, getUser (cookie에서 추출)
- `middleware.js` - Edge Runtime에서 jose로 JWT 검증, 공개 경로 화이트리스트
- API routes 6개 (register, login, logout, me, todos CRUD)

**프론트엔드:**
- `app/layout.js` - 루트 레이아웃 (한국어, Tailwind)
- `app/page.js` - 메인 Todo 페이지 (use client, 할일 CRUD UI)
- `app/login/page.js` - 로그인 폼
- `app/register/page.js` - 회원가입 폼

**설계 결정:**
- NextAuth 대신 직접 JWT 구현 (미니멀 + 워크스페이스 패턴 일관성)
- jose 라이브러리 선택 (Edge Runtime 호환, middleware에서 사용 가능)
- httpOnly 쿠키로 토큰 저장 (XSS 방어)

### 4. 빌드

첫 빌드에서 `@/` 경로 별칭 오류 발생 → `jsconfig.json` 추가로 해결.
두 번째 빌드 성공 (빌드 시간 ~24초).

### 5. Vercel 배포

1. `vercel --yes`로 프로젝트 생성
2. 환경변수 설정 (DATABASE_URL, JWT_SECRET) - Production scope
3. `vercel --prod`로 프로덕션 배포
4. 배포 URL: https://todoapp03.vercel.app

### 6. 기능 테스트 + 스크린샷

Puppeteer (headless) 스크립트를 작성하여 자동화 테스트:
1. 로그인 페이지 접속 확인
2. 회원가입 페이지 이동
3. 회원가입 진행 (테스트유저)
4. 로그인 후 빈 할일 목록 확인
5. 할 일 4개 추가
6. 2개 완료 토글
7. 로그아웃 → 로그인 페이지 리다이렉트 확인

모든 7개 스크린샷 저장 완료 후 Puppeteer 정리(삭제).

### 7. Vercel Deploy Optimizer 체크

배포 상태를 종합 점검:

| 항목 | 결과 |
|------|------|
| vercel.json | 불필요 (Next.js 자동 감지) |
| 환경변수 (Production) | 정상 |
| 환경변수 (Preview/Dev) | 미설정 (경고) |
| 프론트엔드 응답 | 200 OK |
| API 미인증 응답 | 401 Unauthorized (정상) |
| DB 연결 | 정상 (로그인 API 테스트 통과) |
| 미들웨어 | 정상 (/ → /login 리다이렉트) |

**적용한 최적화:**
- `.vercelignore` 생성 (screenshots, .env.local 제외)
- `.env.example` 생성
- DB Pool `max: 3` 설정 (serverless 환경 최적화)
- `poweredByHeader: false` 설정 (보안)
