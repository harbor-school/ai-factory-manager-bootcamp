# Todo App 02

Supabase 인증 + RLS 기반 Todo 앱. React (CDN) + Tailwind CSS로 구현된 단일 HTML 파일 SPA.

## Production

https://todoapp02-wine.vercel.app

## Stack

- React 18 (CDN)
- Supabase Auth + Database (RLS)
- Tailwind CSS (CDN)
- Vercel (Static Hosting)

---

## 작업 로그 (Claude Code 채팅 내역)

### 1. 요구사항

```
workspace/afm-examples-supabasejs/todo_app_02 에 미니멀한 todo 앱 만들어줘

supabasejs dev agents 사용해줘

1. 로그인한 유저만 사용할 수 있어

2. env
project id: **********************
publishable key: sb_publishable_************************************
db 주소: postgresql://postgres.**********************:********@aws-1-us-east-1.pooler.supabase.com:6543/postgres
테이블 prefix: todo_app_02

3. vercel 에 배포하고, 주요 기능들 테스트 해서 스크린샷으로 저 폴더에 남겨줘
```

### 2. 에이전트 구성

프로젝트의 `.claude/agents/` 에 정의된 커스텀 에이전트 3종을 조합하여 사용:

| 에이전트 | 역할 |
|---|---|
| `supabasejs-connector` | Supabase 테이블 생성, RLS 정책, supabase-js CDN 연동 |
| `single-react-dev` | 단일 index.html 파일로 React 앱 구현 |
| `vercel-deploy-optimizer` | Vercel 배포 자동화 (vercel.json, 배포, 검증) |

### 3. 작업 순서

#### Step 1: Supabase 테이블 + RLS 생성

psql로 DB에 직접 연결하여 테이블과 RLS 정책을 생성:

```sql
CREATE TABLE IF NOT EXISTS todo_app_02_todos (
  id bigint generated always as identity primary key,
  text text not null,
  done boolean default false,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz default now()
);

ALTER TABLE todo_app_02_todos ENABLE ROW LEVEL SECURITY;

-- 인증된 유저가 자기 데이터만 접근 가능
CREATE POLICY "Select own" ON todo_app_02_todos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own" ON todo_app_02_todos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own" ON todo_app_02_todos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete own" ON todo_app_02_todos FOR DELETE USING (auth.uid() = user_id);
```

#### Step 2: index.html 작성

`single-react-dev` + `supabasejs-connector` 에이전트의 패턴을 따라 단일 파일로 구현:

- **CDN**: React 18, ReactDOM, Babel, Tailwind CSS, supabase-js v2
- **인증**: 이메일/비밀번호 회원가입 + 로그인, `onAuthStateChange`로 세션 관리
- **CRUD**: 할 일 추가, 완료 토글, 삭제 (낙관적 업데이트)
- **주의**: 전역 변수 충돌 방지를 위해 `const db = window.supabase.createClient(...)` 사용

#### Step 3: Vercel 배포

`vercel-deploy-optimizer` 에이전트가 8단계 체크리스트를 실행:

```
- [x] Step 1: 프로젝트 분석 (Static HTML SPA)
- [x] Step 2: vercel.json 설정 (SPA rewrites)
- [x] Step 3~5: 환경변수 → N/A (Supabase 공개키 HTML 인라인)
- [x] Step 6: vercel --prod 배포 성공
- [x] Step 7: HTTP 200 검증 완료
- [x] Step 8: README 생성
```

배포 URL: https://todoapp02-wine.vercel.app

#### Step 4: 브라우저 테스트 + 스크린샷

Playwright MCP로 실제 배포된 사이트에서 기능 테스트:

| # | 테스트 | 결과 | 스크린샷 |
|---|---|---|---|
| 1 | 로그인 페이지 렌더링 | OK | `screenshots/screenshot_01_login_page.png` |
| 2 | 회원가입 페이지 전환 | OK | `screenshots/screenshot_02_signup_page.png` |
| 3 | 회원가입 → 자동 로그인 → 빈 목록 | OK | `screenshots/screenshot_03_empty_todos.png` |
| 4 | 할 일 3개 추가 (장보기, React 공부하기, 운동 30분) | OK | `screenshots/screenshot_04_todos_added.png` |
| 5 | 완료 토글 (장보기 → 체크 + 취소선) | OK | `screenshots/screenshot_05_todo_completed.png` |
| 6 | 삭제 (운동 30분 제거, 1/2 완료) | OK | `screenshots/screenshot_06_todo_deleted.png` |
| 7 | 로그아웃 → 로그인 페이지 복귀 | OK | `screenshots/screenshot_07_logged_out.png` |

### 4. 파일 구조

```
todo_app_02/
├── index.html          # 앱 전체 (React + Supabase Auth + CRUD)
├── vercel.json         # Vercel SPA 라우팅 설정
├── README.md           # 이 파일
└── screenshots/        # 테스트 스크린샷
    ├── screenshot_01_login_page.png
    ├── screenshot_02_signup_page.png
    ├── screenshot_03_empty_todos.png
    ├── screenshot_04_todos_added.png
    ├── screenshot_05_todo_completed.png
    ├── screenshot_06_todo_deleted.png
    └── screenshot_07_logged_out.png
```
