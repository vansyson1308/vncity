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


def test_opening_and_consequence_standards(tmp_path):
    """The bar docs/gdd/07 scores 5/5 against: every choice flag is read back somewhere, chapter-1
    choices pay off inside chapter 1, and the cold open puts the player in control within a minute,
    offers a choice within three, never idles them for three minutes straight in the first twenty,
    and states the central stake (the house, the paper) within five."""
    pt.main(["--out", str(tmp_path)])
    s = json.loads((tmp_path / "summary.json").read_text(encoding="utf-8"))
    co = s["consequences"]
    assert co["choice_flags"] >= 2 * s["story_missions"]   # at least two choice flags per story mission
    from test_content_logic import READ_IN_NEXT_CHAPTER
    assert set(co["choice_flags_unread"]) <= READ_IN_NEXT_CHAPTER
    assert set(co["progress_flags_unread"]) <= READ_IN_NEXT_CHAPTER
    assert len(co["in_chapter_payoffs"]) >= 20
    assert co["divergent_lines"] >= 100 and co["divergent_steps"] >= 15
    for p in s["personas"].values():
        o = p["opening"]
        assert o["first_control_min"] <= 1.0 and o["first_choice_min"] <= 3.0, o
        assert o["longest_no_control_min"] <= 3.0 and o["first_stake_min"] <= 5.0, o
