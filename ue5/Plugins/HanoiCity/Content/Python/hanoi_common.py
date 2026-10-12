"""Shared helpers for the Hanoi City editor scripts (run inside Unreal's Python).

Paths come from <project>/Config/hanoi_setup.json (relative to the folder holding
HanoiCity.uproject); command-line flags override them:
  --city <dir>       pipeline build (out/<name>) with manifest.json
  --content <dir>    game/content
  --max-tiles N      import only the N tiles nearest the origin (0 = all)
"""

import argparse
import importlib.util
import json
import os
import sys

import unreal

LOG_PREFIX = "[HanoiCity]"


def log(msg):
    unreal.log(f"{LOG_PREFIX} {msg}")


def warn(msg):
    unreal.log_warning(f"{LOG_PREFIX} {msg}")


def error(msg):
    unreal.log_error(f"{LOG_PREFIX} {msg}")


def project_dir():
    return os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))


def content_dir():
    return os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_content_dir()))


def load_config(argv=None):
    """Merged config dict: Config/hanoi_setup.json + CLI overrides, with absolute paths."""
    path = os.path.join(project_dir(), "Config", "hanoi_setup.json")
    with open(path, encoding="utf-8") as f:
        cfg = json.load(f)
    ap = argparse.ArgumentParser(prog="hanoi")
    ap.add_argument("--city")
    ap.add_argument("--content")
    ap.add_argument("--max-tiles", type=int)
    ap.add_argument("--skip-tiles", action="store_true")
    ap.add_argument("--skip-points", action="store_true")
    ap.add_argument("--skip-content", action="store_true")
    args, _ = ap.parse_known_args(sys.argv[1:] if argv is None else argv)
    if args.city:
        cfg["city_build"] = args.city
    if args.content:
        cfg["game_content"] = args.content
    if args.max_tiles is not None:
        cfg["max_tiles"] = args.max_tiles
    for k in ("skip_tiles", "skip_points", "skip_content"):
        cfg[k] = getattr(args, k)
    for k in ("city_build", "game_content", "codegen", "data_json_out"):
        cfg[k] = os.path.normpath(os.path.join(project_dir(), cfg[k]))
    return cfg


def load_codegen(cfg):
    """Import tools/codegen_ue.py (stdlib only) from the repo."""
    spec = importlib.util.spec_from_file_location("codegen_ue", cfg["codegen"])
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_manifest(cfg):
    path = os.path.join(cfg["city_build"], "manifest.json")
    if not os.path.exists(path):
        raise FileNotFoundError(f"{path} not found; run build.py or pass --city")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def asset_tools():
    return unreal.AssetToolsHelpers.get_asset_tools()


def actor_subsystem():
    return unreal.get_editor_subsystem(unreal.EditorActorSubsystem)


def script_struct(name):
    """UScriptStruct for a reflected struct name without the F prefix (e.g. HanoiMissionRow)."""
    cls = getattr(unreal, name, None)
    if cls is not None and hasattr(cls, "static_struct"):
        return cls.static_struct()
    return unreal.load_object(None, f"/Script/HanoiCityRuntime.{name}")


def ensure_data_table(folder, name, struct):
    """Create (or recreate if its row struct changed) the DataTable folder/name."""
    path = f"{folder}/{name}"
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        table = unreal.EditorAssetLibrary.load_asset(path)
        if table and table.get_editor_property("row_struct") == struct:
            return table
        unreal.EditorAssetLibrary.delete_asset(path)
    factory = unreal.DataTableFactory()
    factory.set_editor_property("struct", struct)
    return asset_tools().create_asset(name, folder, unreal.DataTable, factory)


def remove_actors_in_folder(folder):
    """Delete level actors whose outliner folder starts with folder (makes re-runs idempotent)."""
    sub = actor_subsystem()
    doomed = [a for a in sub.get_all_level_actors() if str(a.get_folder_path()).startswith(folder)]
    if doomed:
        sub.destroy_actors(doomed)
    return len(doomed)


def set_spatially_loaded(actor, value):
    try:
        actor.set_editor_property("is_spatially_loaded", value)
    except Exception as e:  # property name differs between versions: verify on first open
        warn(f"could not set is_spatially_loaded on {actor.get_actor_label()}: {e}")
