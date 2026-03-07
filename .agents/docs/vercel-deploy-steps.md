# Vercel 배포 상세 스텝

에이전트가 순서대로 실행할 8개 스텝. 각 스텝은 독립적인 작업 단위이며, **모두 실행해야 한다.**

---

## Step 1: 프로젝트 분석 + 인증 확인

**프로젝트 분석:**

1. 프로젝트 루트에서 핵심 파일을 확인한다:
   - `package.json` → scripts, dependencies 확인
   - `next.config.*` → Next.js
   - `vite.config.*` → Vite SPA
   - 루트 `index.html` → Static HTML 또는 SPA
   - dependencies에 `express`/`fastify`/`koa` → Node.js 서버
   - 기존 `vercel.json` → 기존 설정 확인
   - `.env`, `.env.local`, `.env.production` → 환경변수 파악

2. 프레임워크/스택을 확정하고 보고한다:
   - "Detected **[framework]** app. 최적 설정을 적용합니다."

**인증 확인:**

3. `vercel whoami`로 로그인 상태를 확인한다.
4. 인증되지 않았으면 사용자에게 `vercel login`을 요청한다.

---

## Step 2: vercel.json 설정

프레임워크별 최적 설정을 적용한다.

**Next.js:**
- 기본 설정 유지 (Vercel 자동 감지)
- 필요시 redirects/rewrites 추가

**SPA (React/Vite/CRA):**
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
- 빌드 출력 디렉토리 확인 (`dist` for Vite, `build` for CRA)

**Express / Node.js 서버:**
```json
{
  "version": 2,
  "builds": [{ "src": "server.js", "use": "@vercel/node" }],
  "routes": [
    { "src": "/api/(.*)", "dest": "server.js" },
    { "src": "/(.*)", "dest": "server.js" }
  ]
}
```
- 기존 파일만 수정. 새 파일/api 폴더 생성 금지.
- `app.listen()`, `express.static()`, SPA fallback은 `if (require.main === module)` 가드로 보존.
- `module.exports = app` 추가 (로컬 + Vercel 양립).

**설정 병합 규칙:**
- 기존 `vercel.json`이 있으면 읽고, 누락된 최적화만 추가한다.
- 사용자의 의도적 설정은 절대 덮어쓰지 않는다.
- 배열(rewrites, redirects, headers)은 교체가 아닌 병합한다.

---

## Step 3: 환경변수 설정 + 검증

**설정:**

1. `.env`, `.env.local`, `.env.production`에서 필요한 변수를 파악한다.
2. `vercel env add`로 설정하거나 대시보드 설정을 안내한다.
3. 민감한 값(DB 비밀번호 등)은 대시보드 사용을 권장한다.

**검증:**

4. `vercel env ls`로 설정된 변수를 확인한다.
5. `vercel env pull .env.vercel-check`로 값을 가져와서 검증한다:
   - 개행문자(`\n`, `\r`) 없는지
   - 앞뒤 공백 없는지
   - 오염 발견 시 사용자에게 알리고 CLI로 재설정한다
6. `.env.vercel-check` 임시 파일을 삭제한다.

**환경변수가 필요 없는 프로젝트는 이 스텝을 N/A로 표기한다.**

---

## Step 4: 환경변수 로컬 동기화

1. `vercel env pull .env.local`로 development scope 변수를 가져온다.
   - production-only 변수가 있으면 development scope에도 추가 후 다시 pull한다.
2. `.gitignore`에 `.env.local`이 포함되어 있는지 확인한다. 없으면 추가한다.

---

## Step 5: .env.example 생성

**이 스텝은 독립 작업이다. 반드시 실행하라.**

1. `.env.local`의 키 목록을 기반으로 `.env.example` 파일을 생성한다.
2. 값은 플레이스홀더로 대체한다:
   ```
   DATABASE_URL=postgresql://user:password@host:6543/postgres
   JWT_SECRET=your-jwt-secret
   ```
3. `VERCEL_` 접두사 변수는 제외한다 (Vercel 자동 생성).
4. 이미 `.env.example`이 존재하면 누락된 키만 추가한다.

---

## Step 6: 배포 (vercel --prod)

1. `vercel --prod`를 실행한다.
2. 배포 출력에서 에러를 모니터링한다.
3. 실패 시:
   - 에러 로그를 분석하고 수정을 적용한다.
   - 최대 3회 재시도한다.
   - 3회 실패 시 사용자에게 에스컬레이션한다.
4. 성공 시 **실제 출력에서** 프로덕션 URL을 추출한다.

---

## Step 7: 배포 검증 (Cold Start Warm-up)

1. **프론트엔드 확인:** `curl -s -o /dev/null -w "%{http_code}" [URL]`로 HTTP 200 확인.
2. **API warm-up:** DB 의존 API 엔드포인트에 요청을 보내 cold start를 해소한다.
   - Express + lazy DB init 패턴: 첫 API 요청이 `CREATE TABLE IF NOT EXISTS` 실행.
   - 첫 요청이 500이면 **최대 2회 재시도**.
   - 401 (인증 필요) = 성공. DB 연결 및 초기화 완료.
3. **결과 보고:**
   - Frontend 200 + API 비-500 → 배포 검증 완료.
   - API 반복 실패 → DB 연결 문제 가능성 알림.

---

## Step 8: README 업데이트

1. 프로젝트 루트에 `README.md`가 있는지 확인한다.
2. 있으면 배포 URL 섹션을 추가/업데이트한다.
3. 없으면 최소한의 README를 생성한다:
   ```markdown
   # Project Name

   Production: https://your-project.vercel.app
   ```

---

## 에러 대응 참고

| 상황 | 대응 |
|------|------|
| Cold start + DB init 타이밍 이슈 | Step 7 warm-up으로 해소 |
| 환경변수 개행/공백 오염 | Step 3 검증에서 감지 후 재설정 |
| 모노레포 감지 | 어떤 디렉토리를 배포할지 사용자에게 질문 |
| 빌드 실패 | 에러 로그 읽고 수정 (의존성, TS 에러, import 경로 등) |
| 프로젝트 미연결 | `vercel link --yes`로 처리 |
