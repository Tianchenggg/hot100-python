#!/usr/bin/env python3
"""Extract the supplied Hot 100 recitation Markdown without rewriting its text.

Usage:
    python3 prepare-recitation.py INPUT.md OUTPUT.json [--groups GROUPS.js]

The parser deliberately rejects unknown content inside a problem so extra prose
or examples cannot be silently dropped. Document introduction, table of contents,
and the final 使用建议 section are outside the requested problem-data schema.
"""

import argparse
import json
from pathlib import Path
import re


GROUP = re.compile(r"## (\d+)\. (.+)")
PROBLEM = re.compile(r"### (\d+)\. (.+)")
FIELDS = (
    ("difficulty", "- **难度：** "),
    ("description", "- **核心任务描述：** "),
    (None, "- **输入输出样例：**"),
    ("input", "  - **输入：** "),
    ("output", "  - **输出：** "),
)
REQUIRED_FIELDS = {"id", "title", "difficulty", "description", "input", "output"}


def remove_inline_wrapper(value):
    """Remove only a matching Markdown code delimiter around the whole value."""
    match = re.fullmatch(r"(`+)(.+?)\1", value)
    return match.group(2) if match else value


def parse_recitation(source):
    groups = []
    current_group = None
    current_problem = None
    field_index = 0
    finished = False

    def finish_problem(line_number):
        if current_problem is not None and field_index != len(FIELDS):
            raise ValueError(
                f"Line {line_number}: problem {current_problem['id']} is incomplete"
            )

    for line_number, line in enumerate(source.splitlines(), 1):
        group_match = GROUP.fullmatch(line)
        problem_match = PROBLEM.fullmatch(line)
        if group_match:
            if finished:
                raise ValueError(f"Line {line_number}: unexpected group after 使用建议")
            finish_problem(line_number)
            number, name = group_match.groups()
            if int(number) != len(groups) + 1:
                raise ValueError(f"Line {line_number}: nonconsecutive group number")
            current_group = {"id": f"g{number}", "name": name, "problems": []}
            groups.append(current_group)
            current_problem = None
            field_index = 0
        elif problem_match:
            if current_group is None or finished:
                raise ValueError(f"Line {line_number}: problem outside a group")
            finish_problem(line_number)
            number, title = problem_match.groups()
            current_problem = {"id": int(number), "title": title}
            current_group["problems"].append(current_problem)
            field_index = 0
        elif line == "## 使用建议":
            finish_problem(line_number)
            current_problem = None
            finished = True
        elif not groups or finished:
            # This source's preface/TOC and closing usage advice are not problems.
            continue
        elif not line.strip() or line == "---":
            continue
        elif current_problem is None:
            raise ValueError(f"Line {line_number}: unexpected group content: {line!r}")
        elif field_index >= len(FIELDS):
            raise ValueError(
                f"Line {line_number}: extra prose/example after problem "
                f"{current_problem['id']}: {line!r}"
            )
        else:
            key, prefix = FIELDS[field_index]
            if key is None:
                valid = line == prefix
            else:
                valid = line.startswith(prefix) and len(line) > len(prefix)
            if not valid:
                raise ValueError(
                    f"Line {line_number}: expected {prefix!r}, found {line!r}"
                )
            if key is not None:
                current_problem[key] = remove_inline_wrapper(line[len(prefix):])
            field_index += 1

    finish_problem(len(source.splitlines()) + 1)
    problems = [problem for group in groups for problem in group["problems"]]
    if len(groups) != 17 or len(problems) != 100:
        raise ValueError(f"Expected 17 groups and 100 problems, got {len(groups)} / {len(problems)}")
    if len({problem["id"] for problem in problems}) != 100:
        raise ValueError("Problem IDs are not unique")
    for problem in problems:
        if set(problem) != REQUIRED_FIELDS:
            raise ValueError(f"Problem {problem['id']} has missing or unexpected fields")
        if any(not problem[key] for key in REQUIRED_FIELDS):
            raise ValueError(f"Problem {problem['id']} has an empty field")
        if problem["difficulty"] not in {"简单", "中等", "困难"}:
            raise ValueError(f"Problem {problem['id']} has an unknown difficulty")
    toc = re.findall(r"^(\d+)\. (.+)（(\d+) 题）$", source, re.MULTILINE)
    actual_toc = [(str(i), group["name"], str(len(group["problems"]))) for i, group in enumerate(groups, 1)]
    if toc != actual_toc:
        raise ValueError("The table of contents and parsed groups differ")
    return {"groups": groups}


def verify_groups(data, groups_path):
    """Read the known groups.js data shape without executing JavaScript."""
    source = groups_path.read_text(encoding="utf-8")
    matches = re.findall(
        r"\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*problemIds:\s*\[([\d,\s]+)\]\s*\}",
        source,
    )
    expected = [
        (group_id, name, [int(value) for value in ids.split(",") if value.strip()])
        for group_id, name, ids in matches
    ]
    actual = [
        (group["id"], group["name"], [problem["id"] for problem in group["problems"]])
        for group in data["groups"]
    ]
    if actual != expected:
        raise ValueError(f"Group names, IDs, or problem order differ from {groups_path}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--groups", type=Path, help="Optional groups.js to verify IDs and order")
    args = parser.parse_args()
    try:
        data = parse_recitation(args.input.read_text(encoding="utf-8"))
        if args.groups:
            verify_groups(data, args.groups)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (OSError, ValueError) as error:
        parser.exit(1, f"error: {error}\n")
    print(f"Wrote {args.output}: 17 groups, 100 problems, all six fields present.")
    if args.groups:
        print(f"Group names, IDs, and problem order exactly match {args.groups}.")


if __name__ == "__main__":
    main()
