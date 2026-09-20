#!/usr/bin/env bash
# Claude Code PreToolUse(Bash) 훅. git commit 이고 data/ 에 변경이 있으면 pytest -q -x data/tests 를 먼저 실행한다.
# exit 0 = 통과 또는 해당 없음, exit 2 = 실패(커밋 차단). 비상용 SKIP_COMMIT_GATE=1 은 stderr 에 기록된다.
payload=$(cat)
echo "$payload" | grep -qE '\bgit\b[^|;&]*\bcommit\b' || exit 0
cd "$(dirname "$0")/../../.." || exit 0
git status --porcelain -- data | grep -q . || exit 0
if [ "$SKIP_COMMIT_GATE" = "1" ]; then echo "[data-gate] SKIP_COMMIT_GATE=1 — 테스트 생략 (비상용)" >&2; exit 0; fi
PY=data/.venv/Scripts/python.exe; [ -x "$PY" ] || PY=data/.venv/bin/python
if [ ! -x "$PY" ]; then echo "[data-gate] data/.venv 없음 — 테스트 생략. data/ 코드를 바꿨다면 venv 를 만들어라" >&2; exit 0; fi
out=$(cd data && PYTHONUTF8=1 "../$PY" -m pytest -q -x tests 2>&1); rc=$?
if [ $rc -ne 0 ]; then echo "[data-gate] pytest 실패 — 커밋 차단" >&2; echo "$out" | tail -40 >&2; exit 2; fi
echo "[data-gate] pytest 통과" >&2
