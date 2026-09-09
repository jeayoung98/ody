# output/ — 벤치·리포트 산출물

`tests/bench_*.py`, `scripts/eval_all.py` 가 쓰는 결과. json·md 만 git 에 남고 나머지(parquet, png 등)는 `.gitignore`.
파일명은 `<대상>_<번들버전>.json` (예 `bench_neighbors_v2.1-pca16.json`). 수치는 산출 코드와 같은 커밋에 넣는다(규칙 4).
