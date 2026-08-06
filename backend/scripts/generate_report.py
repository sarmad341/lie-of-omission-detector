"""
Generate a readable Markdown report for a saved case.

Usage:
    python scripts/generate_report.py <case_id>

Saves to reports/<case_id>.md
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.persistence import get_case  # noqa: E402
from pipeline.report_generator import generate_markdown_report  # noqa: E402


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/generate_report.py <case_id>")
        print("(get a case_id by running: python scripts/view_cases.py)")
        sys.exit(1)

    case_id = sys.argv[1]
    case = get_case(case_id)

    report_text = generate_markdown_report(case)

    os.makedirs("reports", exist_ok=True)
    output_path = os.path.join("reports", f"{case_id}.md")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report_text)

    print(f"Report saved to: {output_path}")
    print(f"Open it in VS Code, or any Markdown viewer, to see it formatted.")


if __name__ == "__main__":
    main()
