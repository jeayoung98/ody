# -*- coding: utf-8 -*-
"""카탈로그 정제 파이프라인 디스패처.

  python pipeline/run.py --stage s0_audit    # 읽기 전용 감사 -> output/catalog_audit.md
  python pipeline/run.py --stage s1_dryrun   # 확정 규칙 적중·표본 -> output/exclusion_dryrun.md
  python pipeline/run.py --stage s1_apply    # 사람 승인 후에만. --approve "승인" 필수
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "scripts"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", required=True, choices=["s0_audit", "s1_dryrun", "s1_apply"])
    ap.add_argument("--approve", default="", help='s1_apply 는 --approve "승인" 이 있어야 실행')
    a = ap.parse_args()
    if a.stage == "s0_audit":
        import catalog_audit
        catalog_audit.main()
    elif a.stage == "s1_dryrun":
        import exclusion_apply
        exclusion_apply.main(dry_run=True)
    else:
        if a.approve.strip() != "승인":
            sys.exit('s1_apply 는 사람 승인 뒤에만 실행한다: --approve "승인"')
        import exclusion_apply
        exclusion_apply.main(dry_run=False)


if __name__ == "__main__":
    main()
