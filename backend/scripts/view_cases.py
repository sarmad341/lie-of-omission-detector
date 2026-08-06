"""
List or view saved cases from MongoDB.

Usage:
    python scripts/view_cases.py                 # lists recent cases
    python scripts/view_cases.py <case_id>        # shows full detail for one case
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.persistence import get_case, list_cases  # noqa: E402


def main():
    if len(sys.argv) > 1:
        case_id = sys.argv[1]
        case = get_case(case_id)
        print(json.dumps(case, indent=2, default=str))
        return

    cases = list_cases()
    if not cases:
        print("No cases saved yet. Run scripts/run_full_pipeline.py first.")
        return

    print(f"{'ID':<26} {'Created':<20} {'Document':<30} Claims checked")
    print("-" * 100)
    for c in cases:
        print(
            f"{c['_id']:<26} {str(c['created_at'])[:19]:<20} "
            f"{c['document_name']:<30} {len(c.get('claims_checked', []))}"
        )
    print(f"\nTo view full detail: python scripts/view_cases.py <ID>")


if __name__ == "__main__":
    main()
