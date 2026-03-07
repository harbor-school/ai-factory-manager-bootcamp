# gamja_01 - 당근마켓 클론

Production: https://gamja01.vercel.app

## Tech Stack

| 구분 | 기술 |
|------|------|
| Frontend | React 18 CDN + Tailwind CSS CDN + Babel (single `index.html`) |
| Backend | Express.js (single `server.js`) |
| Database | PostgreSQL (Supabase Pooler) |
| Storage | Supabase Storage (`gamja01-images` bucket) |
| Deploy | Vercel Serverless |
| Image Gen | fal.ai Z-Image Turbo (demo product images) |

## Project Structure

```
gamja_01/
  index.html      # React SPA (전체 프론트엔드)
  server.js        # Express API 서버
  package.json     # 의존성 (express, pg, bcryptjs, jsonwebtoken, cors)
  vercel.json      # Vercel 배포 설정
  .env.example     # 환경변수 템플릿
  BRIEF.md         # 프로젝트 브리프
  screenshots/     # 모바일뷰 테스트 스크린샷
```

## Database Tables

모든 테이블은 `gamja_01_` prefix 사용:

- `gamja_01_users` - 회원 (email, password_hash, nickname, manner_temp, location)
- `gamja_01_products` - 상품 (title, price, category, status, images JSONB, location, is_demo)
- `gamja_01_likes` - 찜/좋아요 (user_id + product_id UNIQUE)
- `gamja_01_chat_rooms` - 채팅방 (product_id, buyer_id, seller_id)
- `gamja_01_messages` - 채팅 메시지 (room_id, sender_id, content, is_read)

## Environment Variables

```
DEMO_SEED=true                    # 데모 상품 활성화
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx  # Supabase service role key
```

## Features (BRIEF.md 기준)

- [x] 1. 이메일/비밀번호 회원가입 및 로그인 (JWT 7일)
- [x] 2. 상품 CRUD (이미지 최대 10장, Supabase Storage 업로드 + URL 직접입력)
- [x] 3. 거래 상태 관리: 판매중 / 예약중 / 거래완료
- [x] 4. 가격 입력 + 가격 제안 받기 + 나눔(무료) 옵션
- [x] 5. GPS 기반 동네 설정 + 반경(3km/5km/10km/20km) 필터링 (Haversine)
- [x] 6. 상품 검색 (제목+내용 ILIKE) + 카테고리 필터
- [x] 7. 1:1 채팅 (3초 polling) + 상품 찜(좋아요)
- [ ] 8. 매너온도 시스템 (36.5도 기본, 변동 로직 미구현)
- [ ] 9. 거래 후기 작성
- [x] 10. 이미지 업로드 (Supabase Storage, browser-image-compression 압축)

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | - | 회원가입 |
| POST | `/api/auth/login` | - | 로그인 |
| GET | `/api/auth/me` | O | 내 정보 |
| PUT | `/api/auth/location` | O | 위치 업데이트 |

### Products
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/products` | - | 상품 목록 (category, search, radius 필터) |
| GET | `/api/products/:id` | - | 상품 상세 (조회수 증가) |
| GET | `/api/products/user/:userId` | - | 유저별 상품 |
| POST | `/api/products` | O | 상품 등록 |
| PUT | `/api/products/:id` | O | 상품 수정 (소유자만) |
| PATCH | `/api/products/:id/status` | O | 상태 변경 |
| DELETE | `/api/products/:id` | O | 상품 삭제 (cascade) |

### Likes
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/products/:id/like` | O | 찜 토글 |
| GET | `/api/likes` | O | 내가 찜한 상품 ID 목록 |

### Chat
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/chat/rooms` | O | 채팅방 생성/조회 |
| GET | `/api/chat/rooms` | O | 내 채팅방 목록 |
| GET | `/api/chat/unread` | O | 읽지 않은 메시지 수 |
| GET | `/api/chat/rooms/:id/messages` | O | 메시지 조회 (읽음 처리) |
| POST | `/api/chat/rooms/:id/messages` | O | 메시지 전송 |

### Upload
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/upload` | O | 이미지 업로드 (base64 → Supabase Storage) |

## Demo Data

`DEMO_SEED=true` 환경변수 설정 시 서버 시작 시 자동으로:
- 3명의 데모 유저 생성 (demo1~3@test.com / demo1234)
- 12개 데모 상품 생성 (fal.ai로 생성한 이미지 포함)
- 서울 강남/서초/송파/마포 지역에 분산 배치

## Screenshots (Mobile View 390x844)

| # | Screenshot | Description |
|---|-----------|-------------|
| 01 | home_product_list | 홈 - 데모 상품 목록 |
| 02 | home_scroll_more | 홈 - 스크롤 더보기 |
| 03 | search_stroller | 검색 - "유모차" 필터 |
| 04 | radius_3km | 반경 3km 필터 |
| 05 | category_digital | 카테고리 - 디지털기기 |
| 06 | product_detail | 상품 상세 - 맥북 프로 |
| 07 | signup | 회원가입 페이지 |
| 08 | login | 로그인 페이지 |
| 09 | mypage | 나의 당근 - 프로필 |
| 10 | product_form | 상품 등록 폼 |
| 11 | product_detail_nanum | 나눔 상품 상세 |
| 12 | status_change_modal | 거래 상태 변경 모달 |
| 13 | product_detail_reserved | 예약중 상품 상세 |
| 14 | product_form_upload_ui | Supabase Storage 이미지 업로드 UI |

---

## Development Log (AI Conversation History)

Claude Code (Opus 4.6) 기반 AI 페어 프로그래밍으로 구현. 민감한 정보(DB password, API key 등)는 `***`로 마스킹.

### Session 1: 프로젝트 설계 + 핵심 기능 구현

**1. Brief 작성** (`/brief` 명령)
- 당근마켓 클론 요구사항 정의 (Q&A 3라운드)
- 기술 스택 결정: single-react-dev + single-server-specialist
- DB: `postgresql://postgres.***:***@aws-1-us-east-1.pooler.supabase.com:6543/postgres`
- 10개 요구사항 + 제약조건 + 비목표 정의 → `BRIEF.md` 저장

**2. 요구사항 1~4 구현** (회원가입, 상품 CRUD, 거래 상태, 가격 옵션)
- `single-server-specialist` + `single-react-dev` 에이전트 병렬 실행
- server.js: Express + pg + bcryptjs + jsonwebtoken
- index.html: React CDN + Tailwind CDN + hash routing SPA
- Vercel 배포 → https://gamja01.vercel.app

**3. 배포 후 버그 수정 (4건)**
- `is_price_negotiable` vs `price_suggestion` 필드명 불일치
- `is_free` 필드 누락
- 하단 가격바와 네비게이션 겹침 → Tailwind CDN에서 `bottom-[72px]` 미지원 → inline style 전환
- `DEMO_SEED` 환경변수 trailing newline (`"true\n"`) → `.trim()` 적용

### Session 2: 위치 필터 + 검색 + 데모 데이터

**4. 요구사항 5~6 구현** (위치 필터, 검색, 카테고리)
- Haversine 공식 SQL 쿼리로 반경 필터링
- 3km/5km/10km/20km 반경 선택 UI
- 텍스트 검색 (ILIKE) + 카테고리 필터 칩 UI

**5. 데모 상품 12개 생성**
- fal.ai Z-Image Turbo API (`fal-image-gen` skill)로 768x768 이미지 12장 생성
- 3명의 데모 유저 (강남맘, 서초대디, 송파거래왕)
- 서울 강남/서초/송파/마포 위치에 분산
- `DEMO_SEED=true` ENV 토글로 show/hide
- 중복 시드 문제 (Vercel 동시 cold start) → cleanup 후 `ON CONFLICT DO NOTHING` 적용

**6. 모바일뷰 테스트 & 스크린샷** (Chrome DevTools MCP)
- 390x844 뷰포트에서 13장 스크린샷 촬영
- 홈, 스크롤, 검색, 반경필터, 카테고리, 상품상세, 회원가입, 로그인, 마이페이지, 글쓰기, 나눔상품, 상태변경모달, 예약중상품

### Session 3: 이미지 업로드 + 찜 + 채팅

**7. Supabase Storage 이미지 업로드** (`supabase-image-uploader` 에이전트)
- server.js: `POST /api/upload` 엔드포인트 (base64 → Supabase REST API)
- 버킷 `gamja01-images` 자동 생성 (initStorage)
- index.html: 드래그 앤 드롭 + 파일 선택 + browser-image-compression 자동 압축
- URL 직접 입력 방식도 유지 (두 가지 병행)

**8. 찜(좋아요) 기능**
- `gamja_01_likes` 테이블 (UNIQUE 제약)
- `POST /api/products/:id/like` 토글 API
- 상품 목록/상세에 like_count 서브쿼리 추가
- 상품 상세 하단 하트 아이콘 + 팝 애니메이션
- 마이페이지 "찜한 상품" 탭

**9. 1:1 채팅 기능** (polling 방식)
- `gamja_01_chat_rooms` + `gamja_01_messages` 테이블
- 채팅방 생성/목록, 메시지 송수신, 읽음 처리 API
- 채팅 목록 페이지: 상품 이미지 + 상대방 + 마지막 메시지 + unread 배지
- 채팅방 페이지: 말풍선 UI (주황/회색) + 3초 polling + optimistic update
- 하단 네비 unread 배지 (30초 polling)
- 상품 상세 "채팅하기" 버튼 → 채팅방 자동 생성/이동

### 주요 기술적 결정

| 결정 | 이유 |
|------|------|
| Single file 아키텍처 | 빠른 프로토타이핑, 배포 단순화 |
| CDN React + Tailwind | 빌드 도구 불필요, 즉시 실행 |
| Hash routing | SPA를 서버 설정 없이 구현 |
| Haversine SQL | 서버 사이드 거리 계산, 인덱스 불필요 (소규모) |
| 3초 polling | WebSocket 대비 구현 단순, 서버리스 호환 |
| base64 업로드 | multipart/form-data 없이 JSON으로 통일 |
| browser-image-compression | 클라이언트 압축으로 서버 부하 감소 |
| DEMO_SEED ENV | 데모 데이터 on/off 전환 가능 |
