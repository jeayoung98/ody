# ODY 팀 Git 컨벤션

커밋, 브랜치, Merge Request(MR) 작성 시 반드시 지키는 규칙. Jira 프로젝트 키는 `S15P21A405`.

---

## 1. 커밋 메시지

### 구조

제목 · 본문 · 꼬리말 세 파트로 나누고, 각 파트는 빈 줄로 구분한다.

```
type: subject

Body

Footer
```

### Type

영어 태그, **소문자**. 콜론 **앞에는 공백 없음, 뒤에만 공백 하나** (`feat: ...`).

| Type | 용도 |
| --- | --- |
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서 수정 |
| `style` | 코드 포맷팅, 세미콜론 누락 등 코드 동작 변경이 없는 경우 |
| `refactor` | 코드 리팩토링 |
| `test` | 테스트 코드 추가/수정 |
| `chore` | 빌드 업무, 패키지 매니저 수정 |
| `config` | 설정 사항 수정 |

### Subject (제목)

- 최대 **50자**, 마침표·특수기호 사용 금지
- 개조식으로 간결하게 (완전한 서술형 문장 X)
- 영문일 경우 **동사 원형**을 맨 앞에, 첫 글자 대문자, 과거형 금지
  - `Fixed` → `Fix`, `Added` → `Add`, `Modified` → `Modify`
- 한글 제목도 허용

### Body (본문)

- 양에 제한 없이 상세히 작성
- **어떻게**보다 **무엇을 / 왜** 변경했는지 설명

### Footer (꼬리말, 선택)

`유형: #이슈번호` 형식. 여러 개는 쉼표로 구분.

| 유형 | 의미 |
| --- | --- |
| `Fixes` | 이슈 수정 중 (아직 미해결) |
| `Resolves` | 이슈 해결 완료 |
| `Ref` | 참고할 이슈 |
| `Related to` | 관련 이슈 (아직 미해결) |

### 예시

```
feat: 회원 가입 기능 구현

SMS, 이메일 중복확인 API 개발

Resolves: #123
Ref: #456
Related to: #48, #45
```

---

## 2. 폴더 구조

역할별로 최상위 디렉토리를 분리한다. 세부 구조·코드 컨벤션은 파트별로 협의.

```
frontend/
backend/
data/
infra/
docs/
```

---

## 3. 브랜치 전략

```
master
│
├─ frontend/dev
│     ├─ frontend/<type>/<issue-key>-<description>
│     └─ frontend/jenkins            (배포용. dev 에서 push)
│
├─ backend/dev
│     └─ backend/<type>/<issue-key>-<description>
│
├─ data/dev
│     └─ data/<type>/<issue-key>-<description>
│
├─ infra
│  └─ infra/<type>/<issue-key>-<description>
│
└─ docs
   └─ common/docs/<issue-key>-<description>
```

| 브랜치 | 역할 | merge target |
| --- | --- | --- |
| `master` | 전체 프로젝트 통합 브랜치. **보관·동기화용** — 여기서 배포하지 않는다 | — |
| `frontend/dev` `backend/dev` `data/dev` | 파트별 통합 브랜치 | `master` |
| `<part>/<type>/<key>-<desc>` | 개별 이슈 작업 브랜치 | `<part>/dev` |
| `infra/<type>/...` · `common/docs/...` | 인프라·문서 작업 브랜치 (파트 dev 없음) | `master` |
| `frontend/jenkins` | **프론트 배포용.** Jenkins 가 이 브랜치를 보고 프론트만 배포한다 | — (`frontend/dev` 에서 push) |

배포 브랜치를 파트마다 따로 두는 이유: `master` 에서 배포하면 프론트·백엔드가 매번 **같이** 나간다.
파트별로 끊어 배포하려고 중간에 둔 브랜치라 Jira Key 가 없고, 작업 브랜치처럼 쓰지 않는다.
백엔드는 이미 `jenkins/backend` 를 쓰고 있다 — 이름 순서가 다르니 헷갈리지 않게 표를 확인한다.

파트 통합 브랜치는 반드시 **`<part>/dev`** 다. 이름 없는 `frontend` 같은 브랜치를 쓰면 안 된다 —
git 은 같은 이름을 ref 이자 디렉터리로 쓸 수 없어서, `frontend` 브랜치가 있으면
`frontend/feat/...` 를 **만들 수 없다** (`refname conflict`).

브랜치는 `bash .claude/hooks/new-branch.sh <part> <type> <KEY> <desc>` 로 만든다.
설정값은 [.claude/jira-config.json](../../.claude/jira-config.json) 이 기준이며 이 표와 같아야 한다.

### 병합 흐름

```
작업 브랜치 → <part>/dev ─┬→ frontend/jenkins   (배포)
                          └→ master             (보관·동기화)
```

`<part>/dev` 에서 오류가 없는 것을 확인한 다음에 배포 브랜치와 `master` 로 각각 push 한다.

**작업 브랜치 → `<part>/dev` 는 항상 MR로 병합하고, `<part>/dev` 에 직접 커밋하지 않는다.**
`frontend/jenkins` 와 `master` 는 `<part>/dev` 검증 후 push 하는 대상이라 MR을 거치지 않는다.

---

## 4. 브랜치 네이밍

```
<part>/<type>/<issue-key>-<description>
```

### Part

| Part | 설명 |
| --- | --- |
| `frontend` | Frontend |
| `backend` | Backend |
| `data` | 데이터 / AI 파이프라인 |
| `infra` | Infra / CI/CD / 서버 |
| `common` | 공통 문서, 파트 구분 없는 작업 |

### Type (브랜치)

| Type | 설명 |
| --- | --- |
| `feat` | 새로운 기능 개발 |
| `fix` | 버그 수정 |
| `refactor` | 기능 변화 없는 코드 구조 개선 |
| `test` | 테스트 추가/수정 |
| `docs` | 문서 작성/수정 |
| `chore` | 설정, 빌드, 패키지, CI/CD 등 |
| `perf` | 성능 개선 |

브랜치 type도 커밋 type과 동일하게 **소문자**.

### Issue Key

모든 작업 브랜치에 Jira Issue Key 필수. 예: `S15P21A405-21`

이슈 → 브랜치 → MR을 동일한 키로 연결한다.

| 대상 | 형식 |
| --- | --- |
| Jira Issue | `S15P21A405-21 음악 검색 API 구현` |
| 브랜치 | `backend/feat/S15P21A405-21-music-search` |
| MR 제목 | `[S15P21A405-21] 음악 검색 API 구현` |

### Description

- 짧고 명확하게, **영문 소문자 kebab-case**
- 공백 대신 `-`

권장:
```
frontend/feat/S15P21A405-10-music-map
backend/feat/S15P21A405-21-music-search
data/feat/S15P21A405-30-knn-search
infra/chore/S15P21A405-40-jenkins-pipeline
common/docs/S15P21A405-50-api-spec
```

비권장:
```
backend/feat/S15P21A405-21-음악 검색 기능 구현   (한글, 공백)
backend/feature/musicSearch                    (type 오타, camelCase, 이슈키 없음)
backend/S15P21A405-21                          (type, description 없음)
```

---

## 5. 기본 원칙

- 브랜치 하나 = Jira Issue 하나
- `master` 와 파트 통합 브랜치(`frontend/dev` `backend/dev` `data/dev`) 직접 push 금지
- 작업은 반드시 작업 브랜치에서 진행
- MR을 통해 코드 리뷰 후 병합
- 브랜치 이름에 Jira Issue Key 필수
- 하나의 브랜치에 관련 없는 작업을 섞지 않음
