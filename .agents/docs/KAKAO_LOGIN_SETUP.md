# 카카오 로그인 설정 가이드

이 문서는 afm-examples 앱에 카카오 로그인을 연동하기 위한 단계별 설정 가이드입니다.

---

## 1단계: 카카오 개발자 계정 만들기

1. [Kakao Developers](https://developers.kakao.com/) 접속
2. 우측 상단 **로그인** 클릭 → 카카오 계정으로 로그인
3. 처음이라면 **개발자 등록** 및 **약관 동의** 진행

---

## 2단계: 애플리케이션 생성

1. 상단 메뉴에서 **내 애플리케이션** 클릭
2. **애플리케이션 추가하기** 클릭
3. 정보 입력:
   - **앱 이름**: `afm-examples` (원하는 이름)
   - **사업자명**: 본인 이름 또는 회사명
4. **저장** 클릭

---

## 3단계: 플랫폼 설정 (Web)

1. 생성된 앱 클릭하여 진입
2. 좌측 메뉴: **앱 설정** > **플랫폼**
3. **Web 플랫폼 등록** 클릭
4. **사이트 도메인** 추가:
   - 로컬 개발용: `http://localhost:3000`
   - 프로덕션용: `https://your-app.vercel.app` (실제 Vercel 도메인)
5. **저장** 클릭

---

## 4단계: 카카오 로그인 활성화

1. 좌측 메뉴: **제품 설정** > **카카오 로그인**
2. **활성화 설정**에서 상태를 **ON**으로 변경

---

## 5단계: Redirect URI 등록

1. 좌측 메뉴: **앱** > **플랫폼 키**
2. REST API 키 항목의 **수정** 버튼 클릭 (또는 키를 클릭)
3. "REST API 키 수정" 페이지 하단의 **카카오 로그인 리다이렉트 URI** 섹션에서 URI 추가
3. URI 추가:
   - 로컬 개발용: `http://localhost:3000/api/auth/kakao/callback`
   - 프로덕션용: `https://your-app.vercel.app/api/auth/kakao/callback`
4. **저장** 클릭

> **중요**: Redirect URI는 환경변수 `KAKAO_REDIRECT_URI`와 정확히 일치해야 합니다. 슬래시(`/`) 하나 차이로도 오류가 발생합니다.

---

## 6단계: 동의항목 설정

1. 좌측 메뉴: **제품 설정** > **카카오 로그인** > **동의항목**
2. **닉네임**이 "필수 동의"로 되어 있는지 확인 (기본값)
3. 이메일 수집은 **불필요** — 카카오 고유 ID로 사용자를 식별합니다

> **참고**: 이메일 수집이 필요 없으므로 **비즈 앱 전환도 불필요**합니다. 닉네임은 기본 프로필 동의항목으로 별도 설정 없이 사용 가능합니다.

---

## 7단계: REST API 키 및 클라이언트 시크릿 확인

1. 좌측 메뉴: **앱** > **플랫폼 키**
2. **REST API 키** 값을 복사
3. REST API 키 카드 하단의 **클라이언트 시크릿** 클릭 → 시크릿 값도 복사

> **주의**: **JavaScript 키**가 아닌 **REST API 키**를 사용해야 합니다. 이 앱은 서버 사이드에서 카카오 API를 호출하므로 REST API 키가 필요합니다.
>
> **중요**: 클라이언트 시크릿이 활성화되어 있으면 토큰 교환 시 반드시 함께 전송해야 합니다. 시크릿이 없으면 `KOE010: Bad client credentials` 에러가 발생합니다.

---

## 8단계: 환경변수 설정

### 로컬 개발

터미널에서 환경변수를 설정한 후 서버를 실행합니다:

```bash
export KAKAO_REST_API_KEY="복사한_REST_API_키"
export KAKAO_CLIENT_SECRET="복사한_클라이언트_시크릿"
export KAKAO_REDIRECT_URI="http://localhost:3000/api/auth/kakao/callback"
npm start
```

### Vercel 배포

Vercel CLI로 환경변수를 추가합니다:

```bash
# REST API 키 (printf로 줄바꿈 없이 입력)
printf '복사한_REST_API_키' | vercel env add KAKAO_REST_API_KEY production
printf '복사한_REST_API_키' | vercel env add KAKAO_REST_API_KEY preview

# 클라이언트 시크릿
printf '복사한_클라이언트_시크릿' | vercel env add KAKAO_CLIENT_SECRET production
printf '복사한_클라이언트_시크릿' | vercel env add KAKAO_CLIENT_SECRET preview

# Redirect URI
printf 'https://your-app.vercel.app/api/auth/kakao/callback' | vercel env add KAKAO_REDIRECT_URI production
printf 'https://your-app.vercel.app/api/auth/kakao/callback' | vercel env add KAKAO_REDIRECT_URI preview
```

또는 [Vercel 대시보드](https://vercel.com/) > 프로젝트 > Settings > Environment Variables에서 직접 추가:

| Key | Value | Environment |
|-----|-------|-------------|
| `KAKAO_REST_API_KEY` | REST API 키 값 | Production, Preview |
| `KAKAO_CLIENT_SECRET` | 클라이언트 시크릿 값 | Production, Preview |
| `KAKAO_REDIRECT_URI` | `https://your-app.vercel.app/api/auth/kakao/callback` | Production, Preview |

---

## 9단계: 비즈 앱 전환 (선택사항)

이 앱은 이메일 수집 없이 카카오 ID + 닉네임만 사용하므로 **비즈 앱 전환이 필수가 아닙니다**.

다만, 본인 외 다른 사용자도 카카오 로그인을 사용하게 하려면 비즈 앱 전환이 필요할 수 있습니다:

1. 좌측 메뉴: **앱 설정** > **비즈니스**
2. **비즈 앱 전환** 클릭
3. 필요 정보 입력 (사업자 등록이 없으면 **개인 개발자**로 전환 가능)

---

## 10단계: 배포 및 테스트

1. Vercel에 배포:
   ```bash
   cd todo
   vercel --prod
   ```

2. 배포된 URL로 접속하여 카카오 로그인 버튼 확인
3. 카카오 로그인 클릭 → 카카오 인증 페이지 → 동의 → 앱으로 리다이렉트
4. 로그인 성공 후 할 일 앱 정상 이용 확인

---

## 트러블슈팅

### KOE010: Bad client credentials

- **원인**: 클라이언트 시크릿이 활성화되어 있는데 토큰 교환 시 전송하지 않음
- **해결**: `KAKAO_CLIENT_SECRET` 환경변수를 설정하고 재배포

### KOE101: Invalid client_id

- **원인**: REST API 키가 잘못됨
- **해결**: 카카오 개발자 콘솔에서 REST API 키를 다시 확인하고 `KAKAO_REST_API_KEY` 환경변수 업데이트

### KOE303: Redirect URI mismatch

- **원인**: 등록된 Redirect URI와 실제 요청 URI가 불일치
- **해결**:
  1. 카카오 개발자 콘솔의 Redirect URI 확인
  2. `KAKAO_REDIRECT_URI` 환경변수와 정확히 일치하는지 확인
  3. `http`/`https`, 끝에 `/` 유무 등 주의

### 카카오 로그인 버튼이 안 보임

- **원인**: `KAKAO_REST_API_KEY` 환경변수 미설정
- **해결**: 환경변수 설정 후 재배포

### 로컬에서 테스트 시 리다이렉트 오류

- **원인**: 플랫폼 도메인 또는 Redirect URI에 `http://localhost:3000`이 등록되지 않음
- **해결**: 카카오 개발자 콘솔에서 로컬 주소 추가

---

## 참고: 계정 방식

카카오 로그인은 이메일을 수집하지 않으므로, 카카오 고유 ID로 별도 계정이 생성됩니다. 기존 이메일/Google 계정과 자동 연동되지 않습니다. 화면에는 카카오 닉네임이 표시됩니다.

---

## 관련 링크

- [Kakao Developers 공식 문서](https://developers.kakao.com/docs/latest/ko/kakaologin/common)
- [카카오 로그인 REST API](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)
- [카카오 디자인 가이드](https://developers.kakao.com/docs/latest/ko/kakaologin/design-guide)
