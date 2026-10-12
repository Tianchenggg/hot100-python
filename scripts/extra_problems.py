"""Shared source for the three extra Hot 20 stock problems."""

import json
from pathlib import Path


EXTRA_IDS = {122, 123, 188}
SOURCE = Path(__file__).with_name("hot20-extra-problems.json")


def load_extra_problems():
    problems = json.loads(SOURCE.read_text(encoding="utf-8"))
    assert {p["id"] for p in problems} == EXTRA_IDS
    return problems


def acm_problem(problem):
    cases = []
    for case in problem["cases"]:
        params = case["params"]
        prices = params["prices"]
        header = str(len(prices))
        if problem["id"] == 188:
            header += " " + str(params["k"])
        cases.append({
            "input": header + "\n" + " ".join(map(str, prices)) + "\n",
            "output": str(case["expected"]) + "\n",
        })
    return {
        **{key: problem[key] for key in ("id", "title", "desc", "difficulty", "url", "constraints")},
        "inputSpec": ("第一行两个整数 n 和 k，分别表示天数和最多交易次数；第二行 n 个整数 prices[i]，表示每天的股票价格。"
                      if problem["id"] == 188 else
                      "第一行一个整数 n，表示天数；第二行 n 个整数 prices[i]，表示每天的股票价格。"),
        "outputSpec": "输出一个整数，表示能获得的最大利润；不交易时利润为 0。",
        "examples": cases[:problem["examples"]],
        "tests": cases,
    }


def recitation_problem(problem):
    acm = acm_problem(problem)
    example = acm["examples"][0]
    return {
        **{key: problem[key] for key in ("id", "title", "difficulty")},
        "description": problem["recitation"],
        "input": example["input"],
        "output": example["output"],
        "inputSpec": acm["inputSpec"],
        "outputSpec": acm["outputSpec"],
    }


def insert_extras(problems, extras):
    original = [p for p in problems if p["id"] not in EXTRA_IDS]
    index = next(i for i, p in enumerate(original) if p["id"] == 121) + 1
    return original[:index] + extras + original[index:]


def add_recitation_extras(data):
    group = next(group for group in data["groups"] if group["id"] == "g14")
    group["problems"] = insert_extras(group["problems"], [recitation_problem(p) for p in load_extra_problems()])
    return data


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1] / "dist" / "data"
    problems = json.loads((root / "problems.json").read_text(encoding="utf-8"))
    problems = insert_extras(problems, [acm_problem(p) for p in load_extra_problems()])
    recitation = add_recitation_extras(json.loads((root / "recitation.json").read_text(encoding="utf-8")))
    for name, data in (("problems", problems), ("recitation", recitation)):
        (root / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
