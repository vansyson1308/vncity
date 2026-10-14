"""Tests for the Unity harness that do not need Unity or .NET: the generated C# is fresh, the
Unity asset map mirrors the UE one, the package files are consistent, and the machine-check
scripts (tools/check_machine.sh / .ps1) share thresholds and decide the same way.

The C# itself is compiled and tested by `dotnet test unity/dotnet` (CI job `unity-core`)."""

import importlib.util
import json
import pathlib
import re
import shutil
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
PKG = ROOT / "unity" / "Packages" / "com.vncity.hanoicity"
SH = ROOT / "tools" / "check_machine.sh"
PS1 = ROOT / "tools" / "check_machine.ps1"


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def test_generated_csharp_is_fresh():
    cgu = _load("codegen_unity", ROOT / "tools" / "codegen_unity.py")
    assert cgu.main(["--check"]) == 0, "run: python tools/codegen_unity.py"


def test_generated_csharp_has_a_row_class_per_collection():
    cgu = _load("codegen_unity", ROOT / "tools" / "codegen_unity.py")
    text = cgu.OUT_PATH.read_text(encoding="utf-8")
    collections = {p.name.split(".")[0] for p in (ROOT / "game" / "schemas").glob("*.schema.json")} - {"common"}
    registered = set(re.findall(r'\{ "(\w+)", typeof\(Hanoi\w+Row\) \}', text))
    assert registered == collections


def test_asset_map_mirrors_ue():
    ue = {k for k in json.loads((ROOT / "ue5" / "Config" / "asset_map.json").read_text()) if not k.startswith("_")}
    un = json.loads((ROOT / "unity" / "hanoi_asset_map.json").read_text())
    assert {k for k in un if not k.startswith("_")} == ue
    for k, v in un.items():
        if k.startswith("_"):
            continue
        assert set(v) >= {"prefab", "prefabs", "scale", "yaw_offset_deg", "cull_distance_m"}, k


def test_package_files_are_valid_json_and_agree():
    pkg = json.loads((PKG / "package.json").read_text())
    manifest = json.loads((ROOT / "unity" / "Packages" / "manifest.json").read_text())
    deps = manifest["dependencies"]
    assert deps[pkg["name"]] == "file:" + pkg["name"]
    for name, version in pkg["dependencies"].items():
        assert deps.get(name) == version, f"{name}: package.json {version} vs manifest {deps.get(name)}"
    asmdefs = {p: json.loads(p.read_text()) for p in PKG.rglob("*.asmdef")}
    names = {a["name"] for a in asmdefs.values()}
    assert {"HanoiCity.Core", "HanoiCity.Unity", "HanoiCity.Editor", "HanoiCity.Core.Tests"} <= names
    core = next(a for a in asmdefs.values() if a["name"] == "HanoiCity.Core")
    assert core["noEngineReferences"] is True, "the core must stay engine-free (it is tested with plain .NET)"
    setup = json.loads((ROOT / "unity" / "hanoi_setup.json").read_text())
    for key in ("city_build", "game_content", "pipeline_districts", "asset_map"):
        target = (ROOT / "unity" / setup[key]).resolve()
        assert str(target).startswith(str(ROOT)), key
    assert (ROOT / "unity" / setup["game_content"]).resolve() == (ROOT / "game" / "content").resolve()


def _thresholds(text):
    block = text.split("# --- thresholds", 1)[1].split("# --- end thresholds", 1)[0]
    return dict(re.findall(r"\$?([A-Z_]+_GB|[A-Z_]+_CORES)\s*=\s*(\d+)", block))


def test_machine_check_scripts_share_thresholds():
    sh = _thresholds(SH.read_text(encoding="utf-8"))
    ps = _thresholds(PS1.read_text(encoding="utf-8-sig"))
    assert sh == ps
    assert len(sh) == 18


def test_ps1_has_bom_for_windows_powershell():
    # Windows PowerShell 5.1 reads a BOM-less script as ANSI and garbles the Vietnamese messages.
    assert PS1.read_bytes()[:3] == b"\xef\xbb\xbf"


CASES = [
    # (facts, recommendation, tier)
    ({"os": "windows", "cores": 8, "ram_gb": 64, "vram_gb": 16, "disk_free_gb": 500, "disk_ssd": "yes"}, "ue5", "recommended"),
    ({"os": "windows", "cores": 8, "ram_gb": 32, "vram_gb": 12, "disk_free_gb": 400, "disk_ssd": "yes"}, "ue5", "minimum"),
    ({"os": "windows", "cores": 8, "ram_gb": 32, "vram_gb": 12, "disk_free_gb": 400, "disk_ssd": "no"}, "unity_hdrp", "recommended"),
    ({"os": "windows", "cores": 6, "ram_gb": 16, "vram_gb": 8, "disk_free_gb": 100, "disk_ssd": "yes"}, "unity_hdrp", "minimum"),
    ({"os": "windows", "cores": 4, "ram_gb": 16, "vram_gb": 2, "disk_free_gb": 80}, "unity_urp", "minimum"),
    ({"os": "windows", "cores": 4, "ram_gb": 8, "vram_gb": 2, "disk_free_gb": 30}, "none", "none"),
    ({"os": "macos", "apple_silicon": "yes", "cores": 10, "ram_gb": 32, "vram_gb": 21, "disk_free_gb": 400, "disk_ssd": "yes"}, "unity_hdrp", "recommended"),
    ({"os": "macos", "apple_silicon": "yes", "cores": 12, "ram_gb": 64, "vram_gb": 42, "disk_free_gb": 400, "disk_ssd": "yes"}, "ue5", "recommended"),
    ({"os": "macos", "apple_silicon": "no", "cores": 8, "ram_gb": 64, "vram_gb": 8, "disk_free_gb": 400, "disk_ssd": "yes"}, "unity_hdrp", "recommended"),
]


def _run(cmd, facts, tmp_path):
    f = tmp_path / "facts.txt"
    f.write_text("".join(f"{k}={v}\n" for k, v in facts.items()), encoding="utf-8")
    out = subprocess.run(cmd + [str(f)], capture_output=True, text=True, encoding="utf-8", timeout=60)
    assert out.returncode == 0, out.stderr
    kv = dict(line.split("=", 1) for line in out.stdout.splitlines() if "=" in line and not line.startswith(" "))
    return kv, out.stdout


@pytest.mark.parametrize("facts,rec,tier", CASES)
def test_check_machine_sh_decides(facts, rec, tier, tmp_path):
    if not shutil.which("bash"):
        pytest.skip("no bash")
    kv, out = _run(["bash", str(SH), "--facts"], facts, tmp_path)
    assert (kv["recommendation"], kv["tier"]) == (rec, tier), out


@pytest.mark.parametrize("facts,rec,tier", CASES)
def test_check_machine_ps1_decides_the_same(facts, rec, tier, tmp_path):
    pwsh = shutil.which("pwsh")
    if not pwsh:
        pytest.skip("no PowerShell (pwsh) on this machine")
    kv, out = _run([pwsh, "-NoProfile", "-File", str(PS1), "-Facts"], facts, tmp_path)
    assert (kv["recommendation"], kv["tier"]) == (rec, tier), out


def test_check_machine_sh_probes_this_machine():
    if not shutil.which("bash") or sys.platform not in ("linux", "darwin"):
        pytest.skip("probe mode is for macOS/Linux")
    out = subprocess.run(["bash", str(SH)], capture_output=True, text=True, timeout=120)
    assert out.returncode == 0, out.stderr
    kv = dict(line.split("=", 1) for line in out.stdout.splitlines() if "=" in line)
    assert int(kv["ram_gb"]) > 0 and int(kv["threads"]) > 0
    assert kv["recommendation"] in {"ue5", "unity_hdrp", "unity_urp", "none"}
