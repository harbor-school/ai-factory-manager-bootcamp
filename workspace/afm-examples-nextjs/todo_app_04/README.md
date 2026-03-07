# Todo App 04

Minimal Todo App built with Next.js 16, Drizzle ORM, and Supabase PostgreSQL.

Production: https://todo-app-04.vercel.app

## Tech Stack

- **Framework**: Next.js 16.1.6 (App Router, TypeScript)
- **Styling**: Tailwind CSS v4
- **ORM**: Drizzle ORM (postgres.js driver)
- **Database**: Supabase PostgreSQL
- **Deployment**: Vercel
- **Architecture**: Server Components + Server Actions (API 라우트 없음)

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # 루트 레이아웃
│   ├── page.tsx            # 메인 페이지 (Server Component, DB 조회)
│   └── globals.css
├── components/
│   ├── todo-form.tsx       # 입력 폼 (Client Component)
│   └── todo-item.tsx       # Todo 아이템 (Client Component)
└── lib/
    ├── actions.ts          # Server Actions (추가/토글/삭제)
    ├── db.ts               # Drizzle DB 연결
    └── schema.ts           # todo_app_04_todos 테이블 스키마
```

## Features

- Todo 추가 (Server Action + form)
- Todo 완료/미완료 토글 (초록 체크마크 + 취소선)
- Todo 삭제 (hover 시 X 버튼 표시)
- 완료 카운터 ("N of M completed")

## Getting Started

1. Copy the environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

2. Install dependencies and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase pooler recommended) |

## Screenshots

| Screenshot | Description |
|------------|-------------|
| ![Empty State](screenshots/01_empty_state.png) | 빈 상태 - "No todos yet" 메시지 |
| ![Todos Added](screenshots/02_todos_added.png) | Todo 3개 추가 후 목록 |
| ![Todos Completed](screenshots/03_todos_completed.png) | 2개 완료 처리 (체크마크 + 취소선 + 카운터) |
| ![Todo Deleted](screenshots/04_todo_deleted.png) | 1개 삭제 후 카운터 업데이트 |

---

## Build Log (Claude Code Chat)

> 민감 정보(DB 비밀번호 등)는 `***`로 마스킹되었습니다.

### 1. 프로젝트 생성 요청

**User:**
```
workspace/afm-examples-nextjs/todo_app_04 여기에 미니멀한 todo 앱 만들어줘

nextjs 16 으로 만들어줘
api 구현 말고 server component 들로 전부 만들어줘
typescript, drizzle 사용해줘

2. env
db 주소: postgresql://postgres.***:***@aws-1-us-east-1.pooler.supabase.com:6543/postgres
테이블 prefix: todo_app_04

3. vercel 에 배포하고, 주요 기능들 테스트 해서 스크린샷으로 저 폴더에 남겨줘
```

### 2. 프로젝트 세팅

**Claude:**
- `npx create-next-app@latest` 로 Next.js 16.1.6 프로젝트 생성
- `drizzle-orm`, `postgres`, `drizzle-kit` 설치
- `.env`, `.env.example` 생성

### 3. 코드 작성

**Claude:**
- `src/lib/schema.ts` - `todo_app_04_todos` 테이블 스키마 (id, title, completed, created_at)
- `src/lib/db.ts` - Drizzle + postgres.js DB 연결
- `src/lib/actions.ts` - Server Actions: `addTodo`, `toggleTodo`, `deleteTodo`
- `src/components/todo-form.tsx` - 입력 폼 (Client Component, useRef로 폼 리셋)
- `src/components/todo-item.tsx` - Todo 아이템 (완료 토글 + 삭제 버튼)
- `src/app/page.tsx` - 메인 페이지 (Server Component, `force-dynamic`)

### 4. DB 테이블 생성

**Claude:**
- `drizzle-kit push` 시도 → 기존 DB 테이블의 CHECK 제약조건 때문에 drizzle-kit 버그 발생
- 직접 SQL로 `CREATE TABLE IF NOT EXISTS todo_app_04_todos` 실행하여 해결

### 5. 빌드 & 배포

**Claude:**
- `npm run build` → 성공 (Turbopack, 5.5s)
- `vercel link --yes` → 프로젝트 연결
- `vercel env add DATABASE_URL production` → 환경변수 설정
- `vercel --prod` → 배포 완료: https://todo-app-04.vercel.app

### 6. 기능 테스트 (브라우저 자동화)

**Claude:** Chrome DevTools MCP로 실제 브라우저에서 테스트

1. **빈 상태 확인** → `01_empty_state.png`
2. **Todo 3개 추가** ("Next.js 프로젝트 세팅하기", "Drizzle ORM 연동하기", "Vercel 배포하기") → `02_todos_added.png`
3. **완료 토글** (2개 완료 처리, "2 of 3 completed") → `03_todos_completed.png`
4. **삭제** ("Drizzle ORM 연동하기" 삭제, "1 of 2 completed") → `04_todo_deleted.png`

### 7. Vercel 배포 최적화 체크

**Claude (vercel-deploy-optimizer):**

| 항목 | 상태 |
|------|------|
| vercel.json | 불필요 (Next.js 자동 감지) |
| DATABASE_URL | 정상 설정 |
| next.config.ts | 기본 설정 최적 |
| .gitignore | .env 포함 확인 |
| 배포 응답 | HTTP 200, 0.29초 |
