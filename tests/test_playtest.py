"""The story dry run must complete without dead ends, on the committed content."""

import json

import tools.playtest as pt


def test_dry_run_reaches_every_story_mission(tmp_path):
    rc = pt.main(["--out", str(tmp_path)])
    summary = json.loads((tmp_path / "summary.json").read_text(encoding="utf-8"))
    assert rc == 0
    assert summary["unreachable_missions"] == []
    assert [i for i in summary["issues"] if i["severity"] == "error"] == []
    assert len(summary["personas"]) == 4


def test_personas_make_different_choices(tmp_path):
    pt.main(["--out", str(tmp_path), "--personas", "tu_te,lieu"])
    summary = json.loads((tmp_path / "summary.json").read_text(encoding="utf-8"))
    a = [c["chose"] for c in summary["personas"]["tu_te"]["choices"]]
    b = [c["chose"] for c in summary["personas"]["lieu"]["choices"]]
    assert a != b


def test_static_checks_catch_a_broken_next():
    w = pt.World()
    m = next(iter(w.missions.values()))
    m["steps"][0]["next"] = "khong_ton_tai"
    errs = [i for i in pt.static_checks(w) if i[0] == "error"]
    assert any("khong_ton_tai" in i[3] for i in errs)
