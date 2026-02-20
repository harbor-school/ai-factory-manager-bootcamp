# Skill: git_commit_writer_ko

## Description
이 Skill은 코드 변경 내용을 기반으로 **일관된 형식의 Git 커밋 메시지**를 생성한다.
Conventional Commit 규칙을 따르되, **키워드(type, scope)만 영어**,
설명과 본문은 **한국어로 작성**하는 것을 강제한다.

디버깅이 없었던 단순 구현과,
문제 분석·실험·원인 규명이 포함된 디버깅 커밋을 자동으로 구분하여 작성한다.

커밋 메시지 생성 전에 **Git 환경을 자동으로 점검·설정**한다.

---

## When to Use
- AI 보조 코딩 결과를 커밋해야 할 때
- 구현은 완료되었고 별도의 디버깅이 없을 때
- 문제 해결 과정을 기록으로 남겨야 할 때
- git log 를 한국어 기반으로 일관되게 유지하고 싶을 때
- AI 작업 여부를 추적 가능한 형태로 남기고 싶을 때
- 새 프로젝트에서 Git 환경이 아직 구성되지 않았을 때

---

## Pre-flight: Git 환경 자동 점검

커밋 메시지를 생성하기 **전에** 아래 항목을 순서대로 점검하고,
누락된 항목이 있으면 사용자에게 안내한 뒤 자동으로 설정한다.

### 1. `git init` 점검
- `git rev-parse --is-inside-work-tree` 실행
- 실패하면 → `git init` 를 실행하여 저장소 초기화
- 사용자에게 "Git 저장소가 초기화되었습니다" 안내

### 2. `git config` (user.name / user.email) 점검
- `git config user.name` 과 `git config user.email` 확인
- 둘 중 하나라도 비어 있으면 → 사용자에게 이름/이메일을 질문
- 응답받은 값으로 **로컬(`--local`)** 설정 적용:
  ```
  git config --local user.name "<이름>"
  git config --local user.email "<이메일>"
  ```
- 이미 global 설정이 있으면 추가 질문 없이 통과

### 3. `.gitignore` 점검
- 프로젝트 루트에 `.gitignore` 파일 존재 여부 확인
- 없으면 → 프로젝트 기술 스택을 자동 감지하여 적절한 `.gitignore` 생성
- 기술 스택 감지 기준:

| 감지 대상 파일 | 판별 스택 |
|---|---|
| `package.json` | Node.js / JavaScript / TypeScript |
| `requirements.txt`, `pyproject.toml`, `setup.py`, `Pipfile` | Python |
| `go.mod` | Go |
| `Cargo.toml` | Rust |
| `pom.xml`, `build.gradle` | Java / Kotlin |
| `Gemfile` | Ruby |
| `*.sln`, `*.csproj` | .NET / C# |
| `Package.swift` | Swift |
| `composer.json` | PHP |

- 감지된 스택에 맞는 표준 무시 패턴 + 공통 패턴을 포함:
  ```
  # === 공통 ===
  .DS_Store
  Thumbs.db
  *.log
  *.swp
  *.swo
  *~
  .env
  .env.*
  !.env.example

  # === IDE ===
  .idea/
  .vscode/
  *.sublime-*

  # === 스택별 패턴 (감지 결과에 따라 추가) ===
  ```
- 생성 후 사용자에게 "`.gitignore`가 생성되었습니다 (감지 스택: Node.js)" 형태로 안내
- 이미 `.gitignore` 가 존재하면 수정하지 않고 통과

### Pre-flight 완료 조건
위 3개 항목이 모두 통과되어야 커밋 메시지 생성 단계로 진입한다.

---

## Inputs
이 Skill은 자유 형식 입력을 허용하지만, 아래 정보가 제공될수록 품질이 향상된다.

### Optional Structured Inputs
- `type`: feat | fix | refactor | perf | build | infra | test | docs | chore
- `scope`: 변경된 기능, 모듈, 패키지 이름
- `ai_used`: true | false
- `debugging`: true | false

### Contextual Inputs (자연어 허용)
- 변경된 내용 요약
- 발생했던 증상
- 원인 분석
- 적용한 해결 방법
- 실제 수행한 검증 방법

---

## Output
- Pre-flight 단계에서 설정한 항목이 있으면 수행 결과를 간결하게 안내
- 이후 **Git 커밋 메시지 텍스트만 출력**
- 마크다운, 설명, 해설, 질문, 이모지 포함 금지
- Conventional Commit 헤더 + 한국어 본문
- 검증(`verify`) 항목 필수

---

## Behavior
이 Skill은 입력을 분석하여 아래 중 하나의 포맷을 선택한다.

### Case 1 — 디버깅 없이 정상 구현된 경우
- `context`, `verify` 중심으로 간결하게 작성
- AI가 주로 작성한 경우 `ai-role: implementation` 포함

### Case 2 — 디버깅 / 문제 해결이 있었던 경우
- `debug-note` 블록 포함
- 가설, 실험, 최종 원인, 검증, 재발 방지까지 기록
- 실제로 수행하지 않은 로그나 실험은 절대 생성하지 않음

### Case 3 — 정보가 매우 부족한 경우
- 최소 안전 커밋 생성

---

## Constraints
- 커밋 키워드(type, scope, 고정 필드명)는 영어
- 설명 문장은 반드시 한국어
- 영어와 한국어를 한 문장에 섞지 않음
- 추측, 과장, 허위 테스트 금지
- verify 항목에는 실제 수행한 검증만 포함

---

## Output Format

### Header
```

<type>(<scope>): <summary>

```

### Body (상황에 따라 선택)

#### Normal Implementation
```

context:

* AI 보조 코딩으로 구현됨

verify:

* 실제 수행한 검증 내용

ai-role: implementation

```

#### Debugging Case
```

--- debug-note ---
when:

* 문제 발생 조건

symptom:

* 관측된 증상

context:

* 환경 정보

observed:

* 실제 로그 또는 현상

hypotheses:

* 원인 가설

experiments:

* 검증 실험 → 결과

root-cause:

* 최종 원인

fix:

* 적용한 해결 방법

verify:

* 해결 여부 확인 방법

prevent:

* 재발 방지 조치

refs:

* 관련 링크
  --- /debug-note ---

```

---

## Example

### Input
```

이미지 업로드 기능을 AI로 구현했다.
별다른 문제 없이 동작했고,
드래그 앤 드롭 업로드를 직접 테스트했다.

```

### Output
```

feat(upload): 이미지 드래그 앤 드롭 업로드 추가

context:

* AI 보조 코딩으로 구현됨

verify:

* 이미지 드래그 → 미리보기 표시 → 업로드 요청 정상 처리

ai-role: implementation

```

---

## Fail-safe Behavior
입력 정보가 부족한 경우 아래 최소 커밋을 생성한다.

```

chore(<scope>): apply implementation

verify:

* 기본 동작 수동 확인

```

---

## Notes
이 Skill은 다음 용도로 확장 가능하다.
- PR description 자동 생성
- debug-note → Fix Card 변환
- git commit-msg hook 연동
- Pre-flight 항목 확장 (branch 보호 규칙 점검, remote 연결 등)


