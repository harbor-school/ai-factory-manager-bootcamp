# Todo App 02 - Realtime

Supabase Realtime 기반 Todo 앱. React (CDN) + Supabase JS로 구현된 정적 사이트.

## Production

https://todoapp05realtime.vercel.app

## Features

- 이메일/비밀번호 인증 (Supabase Auth)
- Todo CRUD with Realtime sync (postgres_changes)
- 다른 탭/기기의 변경사항 실시간 반영 (flash animation)
- Optimistic UI + Realtime 중복 방지
- Tailwind CSS 스타일링

## todo_app_02 vs todo_app_02_realtime 비교

### 통신 방식 차이

```mermaid
flowchart LR
    subgraph WITHOUT["todo_app_02 — Realtime 없음"]
        direction TB
        A1["🖥️ Browser"] -- "① REST 요청\nINSERT/UPDATE/DELETE" --> S1["☁️ Supabase DB"]
        S1 -- "② REST 응답\n{ data }" --> A1
        A1 -. "③ 다른 탭은?\n새로고침 전까지 모름 ❌" .-> A2["🖥️ Browser B"]
    end

    subgraph WITH["todo_app_02_realtime — Realtime 있음"]
        direction TB
        B1["🖥️ Browser A"] -- "① REST 요청" --> S2["☁️ Supabase DB"]
        S2 -- "② REST 응답" --> B1
        S2 -- "③ WAL 변경 감지" --> RT["📡 Realtime"]
        RT -- "④ WebSocket 푸시" --> B1
        RT -- "④ WebSocket 푸시" --> B2["🖥️ Browser B"]
    end
```

### 데이터 흐름 비교

```mermaid
sequenceDiagram
    participant A as 🖥️ Tab A
    participant DB as ☁️ Supabase DB
    participant B as 🖥️ Tab B

    rect rgb(255, 240, 240)
        Note over A, B: ❌ todo_app_02 (Realtime 없음)
        A->>DB: INSERT "장보기"
        DB-->>A: { data } → UI 반영
        Note over B: B는 모름. 새로고침해야 보임
        B->>DB: SELECT * (새로고침)
        DB-->>B: 전체 목록 다시 받음
    end

    rect rgb(240, 255, 240)
        Note over A, B: ✅ todo_app_02_realtime (Realtime 있음)
        A->>DB: INSERT "장보기"
        DB-->>A: { data } → Optimistic UI
        DB--)B: WebSocket INSERT 이벤트
        Note over B: 자동 반영 + flash 💙
    end
```

### 코드 차이 요약

| 항목 | `todo_app_02` | `todo_app_02_realtime` |
|------|--------------|----------------------|
| **프로토콜** | REST API만 사용 | REST API + WebSocket |
| **데이터 동기화** | 페이지 로드 시 1회 fetch | 로드 시 fetch + 실시간 구독 |
| **다른 탭 반영** | 새로고침 필요 | 자동 반영 (INSERT/UPDATE/DELETE) |
| **연결 상태 표시** | 없음 | Live 인디케이터 (초록 dot) |
| **원격 변경 피드백** | 없음 | flash 애니메이션 (파란색) |
| **중복 방지 로직** | 없음 (불필요) | `localActionIds` ref로 본인 이벤트 무시 |
| **에러 복구** | API 실패 시 `fetchTodos()` 재호출 | Realtime이 자동으로 최신 상태 유지 |
| **DB 설정** | 테이블 + RLS | 테이블 + RLS + `ALTER PUBLICATION` |
| **추가 컴포넌트** | 없음 | `RealtimeStatus` |
| **추가 CSS** | `slideIn` 1개 | `slideIn` + `flash` + `pulse` 3개 |

### 추가된 코드 (핵심 부분만)

```mermaid
flowchart TD
    subgraph ADDED["🆕 Realtime 버전에서 추가된 것"]
        CH["db.channel('todos-realtime')\nWebSocket 채널 생성"]
        SUB[".on('postgres_changes', ...)\nINSERT / UPDATE / DELETE\n3개 이벤트 구독"]
        STATUS["RealtimeStatus 컴포넌트\nSUBSCRIBED → 🟢 Live\nSUBSCRIBING → 🟡 연결 중\nCLOSED → 🔴 연결 끊김"]
        LOCAL["localActionIds (useRef)\n본인 액션 ID 추적\n→ Realtime 이벤트와 중복 방지"]
        FLASH["flashIds (useState)\n원격 변경 시 파란색 flash\n700ms 후 자동 해제"]
    end

    CH --> SUB
    SUB --> STATUS
    SUB --> LOCAL
    SUB --> FLASH
```

---

## Architecture

### 전체 구조

```mermaid
flowchart TB
    subgraph Browser["🖥️ Browser (index.html)"]
        React["React 18 (CDN)"]
        SB_Client["supabase-js Client"]
        UI["Todo UI + Auth UI"]
    end

    subgraph Supabase["☁️ Supabase"]
        Auth["Auth Service"]
        DB["PostgreSQL\ntodo_app_02_todos"]
        RT["Realtime Server"]
        RLS["Row Level Security"]
    end

    UI --> React
    React --> SB_Client
    SB_Client -- "REST API\n(CRUD)" --> DB
    SB_Client -- "Auth API\n(login/signup)" --> Auth
    SB_Client -- "WebSocket\n(subscribe)" --> RT
    DB -- "postgres_changes\n(WAL)" --> RT
    RLS -- "user_id = auth.uid()\nfilter" --> DB
    Auth -- "JWT" --> RLS
```

### Realtime 동작 흐름

```mermaid
sequenceDiagram
    participant A as 🖥️ Browser A
    participant S as ☁️ Supabase DB
    participant RT as 📡 Realtime
    participant B as 🖥️ Browser B

    Note over A, B: 두 브라우저 모두 같은 계정으로 로그인

    A->>RT: channel.subscribe('postgres_changes')
    B->>RT: channel.subscribe('postgres_changes')
    RT-->>A: status: SUBSCRIBED ✅
    RT-->>B: status: SUBSCRIBED ✅

    Note over A: 할 일 추가
    A->>S: INSERT { text: "새 할일", user_id }
    A->>A: Optimistic UI 즉시 반영
    S->>RT: WAL → postgres_changes (INSERT)
    RT-->>A: payload.new (localActionIds로 중복 무시)
    RT-->>B: payload.new → 목록에 추가 + flash 애니메이션

    Note over B: 할 일 완료 체크
    B->>S: UPDATE { done: true }
    B->>B: Optimistic UI 즉시 반영
    S->>RT: WAL → postgres_changes (UPDATE)
    RT-->>B: payload.new (localActionIds로 중복 무시)
    RT-->>A: payload.new → 체크 표시 + flash 애니메이션
```

### RLS + Realtime 보안

```mermaid
flowchart LR
    subgraph Auth["인증"]
        Login["로그인"] --> JWT["JWT 토큰 발급"]
    end

    subgraph RLS["Row Level Security"]
        SELECT["SELECT: user_id = auth.uid()"]
        INSERT["INSERT: user_id = auth.uid()"]
        UPDATE["UPDATE: user_id = auth.uid()"]
        DELETE["DELETE: user_id = auth.uid()"]
    end

    subgraph RT["Realtime 필터"]
        Filter["JWT 기반 RLS 적용\n→ 본인 todo만 수신"]
    end

    JWT --> SELECT & INSERT & UPDATE & DELETE
    JWT --> Filter
```

### Optimistic UI + Realtime 중복 방지

```mermaid
flowchart TD
    Action["사용자 액션\n(추가/수정/삭제)"] --> LocalUpdate["1️⃣ 로컬 State 즉시 반영\n(Optimistic UI)"]
    Action --> TrackId["2️⃣ localActionIds에 ID 등록"]
    Action --> ApiCall["3️⃣ Supabase API 호출"]

    ApiCall --> DB["DB 반영"]
    DB --> RT["Realtime 이벤트 발생"]
    RT --> Check{"localActionIds에\n해당 ID 있음?"}

    Check -- "Yes (본인 액션)" --> Skip["무시 (이미 반영됨)"]
    Check -- "No (다른 탭/기기)" --> Apply["State 업데이트\n+ flash 애니메이션 💙"]
```

## DB Setup

`setup_db.js`로 Supabase 테이블 생성 + RLS 정책 + Realtime 활성화를 할 수 있습니다.

```bash
npm install pg
node setup_db.js
```

주요 SQL:
```sql
-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE todo_app_02_todos;
```

## Screenshots

| 로그인 | 빈 목록 (Live) | 할 일 추가 |
|--------|---------------|-----------|
| ![](screenshots/01_login_page.png) | ![](screenshots/02_empty_todos_live.png) | ![](screenshots/03_todos_added.png) |

| 완료 체크 | 삭제 후 | 로그아웃 |
|----------|--------|---------|
| ![](screenshots/04_todo_completed.png) | ![](screenshots/05_todo_deleted.png) | ![](screenshots/06_logged_out.png) |
