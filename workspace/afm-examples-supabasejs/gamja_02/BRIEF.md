# Brief: 당근마켓 클론 (gamja_02)

> 당근마켓 핵심 기능 클론 — Supabase-js CDN으로 백엔드 없이 프론트엔드 단독 구현.

## Requirements
- [ ] 1. Supabase Auth 이메일/비밀번호 회원가입 및 로그인
- [ ] 2. 상품 CRUD (제목, 설명, 가격, 카테고리, 이미지 최대 10장, 거래 장소)
- [ ] 3. 거래 상태 관리: 판매중 / 예약중 / 거래완료
- [ ] 4. 가격 입력 + "가격 제안 받기" 옵션 + 나눔(무료) 옵션
- [ ] 5. 브라우저 Geolocation 기반 동네 설정, 반경(3km/5km/10km) 필터링
- [ ] 6. 상품 검색 (제목+내용 텍스트) + 카테고리 필터
- [ ] 7. 1:1 채팅 (Supabase Realtime subscribe)
- [ ] 8. 매너온도 시스템: 36.5도 시작, 거래 후기에 따라 ±0.1~0.5도 변동
- [ ] 9. 거래 후기 작성 (거래완료 후)
- [ ] 10. 이미지 업로드 (Supabase Storage, 프론트엔드 직접 업로드)

## Constraints
- 프론트엔드: single index.html (React CDN + Tailwind CSS + supabase-js CDN)
- 백엔드: 없음 — 모든 로직 supabase-js로 처리
- DB: Supabase (project: gzrhlmqlhdeoziequzcu)
- 테이블 prefix: `gamja_02_`
- 테이블: users, products, chats, messages, reviews
- 카테고리: 하드코딩 10개 (디지털기기, 가구, 의류 등)
- RLS 정책 적용 (로그인 사용자 본인 데이터 보호)
- 이미지 Storage bucket: `gamja_02_images`

## Non-goals
- 동네생활 (커뮤니티) 기능
- 소셜 로그인 / 전화번호 인증
- 별도 백엔드 서버

## Style
- 당근마켓 UI/UX 최대한 유사 — 주황색 메인 컬러, 카드형 상품 리스트
- 모바일 퍼스트 레이아웃
- 직관적이고 깔끔한 인터페이스

## Key Concepts
- **매너온도**: 사용자 신뢰도 지표. 36.5도 기본, 거래 후기 평가로 변동
- **동네 인증**: GPS 좌표 기반으로 현재 위치 동네 설정
- **나눔**: 가격 0원, 무료 나눔 거래
- **거래 상태**: 판매중 → 예약중 → 거래완료 흐름
- **Supabase Realtime**: 채팅 메시지 실시간 구독
