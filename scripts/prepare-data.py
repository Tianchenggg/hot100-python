#!/usr/bin/env python3
"""Export the Python ACM problem data from a local hot100-judge checkout."""

import argparse
import json
import shutil
from pathlib import Path


def correct_output_order(entry):
    problem_id = entry["id"]
    if problem_id == 15:
        entry["desc"] = entry["desc"].replace("，本平台以题解输出的顺序为准", "")
        entry["outputSpec"] = "每个满足条件的三元组占一行，三个数以空格分隔；三元组之间与组内数字的顺序均不限。若无满足条件的三元组，输出空行。"
    elif problem_id == 49:
        entry["desc"] = entry["desc"].replace("，本平台按各组第一次出现的顺序输出", "")
        entry["outputSpec"] = "每组字母异位词占一行，组内字符串以空格分隔；各组与组内字符串的顺序均不限。若 n 为 0，输出空行。"
    elif problem_id == 131:
        entry["outputSpec"] = entry["outputSpec"].replace("方案按确定性顺序输出（逐位优先取更短的回文前缀）。", "方案之间的顺序任意，方案内的子串应保持在原字符串中的先后顺序。")
    elif problem_id == 347:
        entry["desc"] = entry["desc"].replace("，本题以参考题解的确定性顺序作为评测基准", "")
        entry["outputSpec"] = "输出频率最高的 k 个元素，顺序任意，空格分隔，末尾换行。"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Local hot100-judge repository")
    parser.add_argument("--references", type=Path, help="Optional non-deployed QA reference output")
    args = parser.parse_args()
    project = Path(__file__).resolve().parents[1]
    source = args.source.resolve()
    data = source / "public" / "data"
    problems = json.loads((data / "problems.json").read_text(encoding="utf-8"))
    tests = json.loads((data / "tests.json").read_text(encoding="utf-8"))
    expected_fields = {
        "id", "title", "desc", "difficulty", "url", "inputSpec",
        "outputSpec", "examples", "tests",
    }
    exported = []
    seen = set()
    for problem in problems:
        problem_id = problem["id"]
        assert type(problem_id) is int and problem_id not in seen
        seen.add(problem_id)
        acm = problem["acm"]
        entry = {
            "id": problem_id,
            "title": problem["title"],
            "desc": problem["desc"],
            "difficulty": problem["difficulty"],
            "url": problem["url"],
            "inputSpec": acm["input"],
            "outputSpec": acm["output"],
            "examples": [
                {"input": case["input"], "output": case["output"]}
                for case in acm["examples"]
            ],
            "tests": [
                {"input": case["input"], "output": case["output"]}
                for case in tests[str(problem_id)]["acm"]
            ],
        }
        correct_output_order(entry)
        assert set(entry) == expected_fields
        for field in ("title", "desc", "difficulty", "url", "inputSpec", "outputSpec"):
            assert isinstance(entry[field], str) and entry[field].strip(), (problem_id, field)
        assert entry["url"].startswith("https://leetcode.cn/problems/")
        for field in ("examples", "tests"):
            assert entry[field], (problem_id, field)
            for case in entry[field]:
                assert set(case) == {"input", "output"}
                assert all(isinstance(value, str) for value in case.values())
        exported.append(entry)
    assert len(exported) == 100, len(exported)
    assert sum(len(problem["tests"]) for problem in exported) == 478
    corrections = json.loads((project / "scripts" / "problem-corrections.json").read_text(encoding="utf-8"))
    for entry in exported:
        patch = corrections[str(entry["id"])]
        entry.update(patch["shared"])
        specific = patch["acm"]
        for field, value in specific.items():
            if field not in ("examplesReplacements", "testsReplacements", "additionalTests"):
                entry[field] = value
        for field in ("examples", "tests"):
            for index, value in specific.get(field + "Replacements", {}).items():
                entry[field][int(index)] = value
        entry["tests"].extend(specific.get("additionalTests", []))
    output = project / "dist" / "data" / "problems.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(exported, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    shutil.copyfile(source / "LICENSE", project / "LICENSE")
    if args.references:
        assert project not in args.references.resolve().parents, "QA answers must stay outside the project"
        solutions = json.loads((data / "solutions.json").read_text(encoding="utf-8"))
        references = {str(problem["id"]): solutions[str(problem["id"])]["python3"]["acm"] for problem in exported}
        assert len(references) == 100 and all(isinstance(code, str) and code.strip() for code in references.values())
        args.references.parent.mkdir(parents=True, exist_ok=True)
        args.references.write_text(json.dumps(references, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "problems": len(exported),
        "examples": sum(len(problem["examples"]) for problem in exported),
        "tests": sum(len(problem["tests"]) for problem in exported),
        "minTestsPerProblem": min(len(problem["tests"]) for problem in exported),
        "maxTestsPerProblem": max(len(problem["tests"]) for problem in exported),
        "output": str(output),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
