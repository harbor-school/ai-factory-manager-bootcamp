# Todo App 01

Full-stack todo application with Express.js backend (PostgreSQL) and React frontend.

## Production

https://todo-app-01-amber.vercel.app

## Tech Stack

- **Backend**: Express.js + PostgreSQL (Supabase) + JWT Auth
- **Frontend**: React 18 + Tailwind CSS (CDN, single index.html)
- **Deploy**: Vercel Serverless

## API Endpoints

- `POST /api/register` - Create a new user
- `POST /api/login` - Authenticate and return JWT
- `GET /api/todos` - List todos (auth required)
- `POST /api/todos` - Create a todo (auth required)
- `PATCH /api/todos/:id` - Update a todo (auth required)
- `DELETE /api/todos/:id` - Delete a todo (auth required)

## Local Development

```bash
npm install
npm start
```

Server runs on http://localhost:3000

---

## Build Log (Claude Code Chat)

> 이 앱은 Claude Code (Opus 4.6)와의 대화를 통해 만들어졌습니다.
> 아래는 실제 채팅 기록을 정리한 것입니다.

### 1. 요청

**User:**
```
workspace/afm-examples-backend/todo_app_01 에 미니멀한 todo 앱 만들어줘

single dev agents 사용해줘

1. 로그인한 유저만 사용할 수 있어

2. env
db 주소: postgresql://postgres.xxxxx:********@aws-1-us-east-1.pooler.supabase.com:6543/postgres
테이블 prefix: todo_app_01

3. vercel 에 배포하고, 주요 기능들 테스트 해서 스크린샷으로 저 폴더에 남겨줘
```

### 2. 구현 (병렬 에이전트)

Claude는 두 개의 에이전트를 **동시에** 실행했습니다:

| Agent | 역할 | 산출물 |
|-------|------|--------|
| `single-server-specialist` | Express 백엔드 (PostgreSQL + JWT + CRUD) | `server.js`, `package.json` |
| `single-react-dev` | React + Tailwind 프론트엔드 (CDN SPA) | `index.html` |

**Backend agent 결과:**
- DB 테이블 자동 생성 (`todo_app_01_users`, `todo_app_01_todos`)
- JWT 기반 인증 (register/login)
- Todo CRUD with ownership check
- Vercel serverless 호환 (`module.exports = app`)
- 실제 Supabase DB로 integration test 통과

**Frontend agent 결과:**
- Login/Register 토글 UI
- Todo 추가/완료 토글/삭제
- localStorage 기반 세션 유지
- 401 시 자동 로그아웃

### 3. 배포

`vercel-deploy-optimizer` 에이전트로 Vercel 배포:

```
Production URL: https://todo-app-01-amber.vercel.app
```

`vercel.json` 설정:
```json
{
  "version": 2,
  "builds": [
    { "src": "server.js", "use": "@vercel/node" },
    { "src": "index.html", "use": "@vercel/static" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/server.js" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

### 4. 디버깅 - API 응답 구조 불일치

배포 후 브라우저 테스트에서 **로그인은 되지만 바로 로그아웃되는 문제** 발생.

**증상:**
- 로그인/회원가입 클릭 시 화면이 다시 로그인으로 돌아감
- 콘솔에 `Failed to load resource` 에러 (`/api/todos`)

**원인 분석:**
- 서버 응답: `{ success: true, data: { token: "...", user: { email: "..." } } }`
- 프론트엔드 기대: `{ token: "...", email: "..." }` (최상위 레벨)
- `data.token`이 `undefined`가 되어 localStorage에 빈 값 저장
- 이후 `/api/todos` 호출 시 401 -> 자동 로그아웃

**수정 (index.html):**

1. `apiFetch` 함수에서 응답의 `data` 필드를 자동 unwrap:
```js
// Before
return res.json();

// After
const json = await res.json();
return json.data !== undefined ? json.data : json;
```

2. 로그인 시 user.email 경로 수정:
```js
// Before
const userEmail = data.email || email.trim();

// After
const userEmail = (data.user && data.user.email) || data.email || email.trim();
```

수정 후 재배포하여 정상 동작 확인.

### 5. 기능 테스트 스크린샷

Playwright 브라우저 자동화로 전체 플로우 테스트:

| # | 스크린샷 | 테스트 내용 |
|---|---------|------------|
| 1 | ![login](screenshots/screenshot_01_login.png) | 로그인 화면 |
| 2 | ![register](screenshots/screenshot_02_register.png) | 회원가입 폼 입력 |
| 3 | ![empty](screenshots/screenshot_03_empty_todos.png) | 로그인 후 빈 Todo 목록 |
| 4 | ![added](screenshots/screenshot_04_todos_added.png) | Todo 3개 추가 |
| 5 | ![completed](screenshots/screenshot_05_todos_completed.png) | 완료 토글 (체크 + 취소선) |
| 6 | ![deleted](screenshots/screenshot_06_todo_deleted.png) | Todo 삭제 |

### 6. 커밋

```
feat(todo_app_01): 미니멀 Todo 앱 구현 및 Vercel 배포

context:
* AI 보조 코딩으로 백엔드(Express + PostgreSQL) 및 프론트엔드(React + Tailwind CDN) 구현
* JWT 기반 인증 (회원가입/로그인) 적용, 로그인한 유저만 Todo CRUD 가능
* Supabase PostgreSQL 연동, 테이블 prefix todo_app_01_ 사용
* Vercel 서버리스 배포 완료

verify:
* 회원가입 -> 로그인 -> Todo 추가/완료 토글/삭제 전체 플로우 브라우저 테스트
* 주요 기능별 스크린샷 6장 screenshots/ 폴더에 저장

ai-role: implementation
```

---

**Total time**: ~6 minutes (agent parallel execution + deploy + browser test)
**Model**: Claude Opus 4.6 via Claude Code CLI
