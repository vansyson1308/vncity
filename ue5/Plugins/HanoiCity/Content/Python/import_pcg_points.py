"""out/<city>/pcg/<set>.csv -> DataTables + instanced meshes.

1. Every CSV becomes DataTable /Game/Hanoi/City/Points/DT_pcg_<set> with row struct
   FHanoiPcgPointRow (raw ENU metres, exactly the CSV). PCG graphs can read these later.
2. For each (Set, Kind, Tile) whose Config/asset_map.json entry ("<Set>/<Kind>" or "<Set>/*")
   names a mesh, one AHanoiPointSetActor (HISM) is spawned under City/Points/<Set>.
   Empty mesh = skipped, so this is safe to run before any art exists.

Transform per row: location UE = (100 X, -100 Y, 100 Z), yaw UE = -Yaw + yaw_offset_deg,
uniform scale = Scale * entry.scale.

Usage: Tools > Hanoi City > Import PCG Points, or py import_pcg_points.py --city ../out/hoankiem
"""

import collections
import csv
import glob
import json
import os

import unreal

import hanoi_common as hc
import hanoi_geo


def load_asset_map():
    with open(os.path.join(hc.project_dir(), "Config", "asset_map.json"), encoding="utf-8") as f:
        return {k: v for k, v in json.load(f).items() if not k.startswith("_")}


def lookup(asset_map, set_name, kind):
    return asset_map.get(f"{set_name}/{kind}") or asset_map.get(f"{set_name}/*")


def import_tables(cfg, csv_paths):
    struct = hc.script_struct("HanoiPcgPointRow")
    folder = cfg["points_dest"]
    for path in csv_paths:
        set_name = os.path.splitext(os.path.basename(path))[0]
        name = f"DT_pcg_{set_name}"
        table = hc.ensure_data_table(folder, name, struct)
        if not unreal.DataTableFunctionLibrary.fill_data_table_from_csv_file(table, path, struct):
            hc.error(f"CSV import failed for {path} (see Output Log)")
        unreal.EditorAssetLibrary.save_asset(f"{folder}/{name}", only_if_is_dirty=False)
    hc.log(f"{len(csv_paths)} point DataTables under {folder}")


def spawn_instances(csv_paths):
    asset_map = load_asset_map()
    hc.remove_actors_in_folder("City/Points")
    sub = hc.actor_subsystem()
    spawned, skipped = 0, collections.Counter()
    for path in csv_paths:
        groups = collections.defaultdict(list)
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                groups[(row["Set"], row["Kind"], row["Tile"])].append(row)
        for (set_name, kind, tile), rows in sorted(groups.items()):
            entry = lookup(asset_map, set_name, kind)
            if not entry or not entry.get("mesh"):
                skipped[f"{set_name}/{kind}"] += len(rows)
                continue
            mesh = unreal.EditorAssetLibrary.load_asset(entry["mesh"])
            if not isinstance(mesh, unreal.StaticMesh):
                hc.warn(f"{set_name}/{kind}: {entry['mesh']} is not a StaticMesh")
                continue
            pts = [hanoi_geo.enu_to_ue(float(r["X"]), float(r["Y"]), float(r["Z"])) for r in rows]
            cx = sum(p[0] for p in pts) / len(pts)
            cy = sum(p[1] for p in pts) / len(pts)
            transforms = []
            for r, p in zip(rows, pts):
                s = float(r["Scale"] or 1.0) * float(entry.get("scale", 1.0))
                yaw = hanoi_geo.ue_yaw(float(r["Yaw"])) + float(entry.get("yaw_offset_deg", 0.0))
                transforms.append(unreal.Transform(
                    location=unreal.Vector(p[0] - cx, p[1] - cy, p[2]),
                    rotation=unreal.Rotator(roll=0.0, pitch=0.0, yaw=yaw),
                    scale=unreal.Vector(s, s, s)))
            actor = sub.spawn_actor_from_class(unreal.HanoiPointSetActor, unreal.Vector(cx, cy, 0.0))
            actor.set_editor_property("set", set_name)
            actor.set_editor_property("kind", kind)
            actor.set_editor_property("tile", tile)
            actor.set_instances(mesh, transforms, float(entry.get("cull_distance_m", 0)))
            actor.set_actor_label(f"{set_name}_{kind}_{tile}")
            actor.set_folder_path(f"City/Points/{set_name}")
            spawned += 1
    if skipped:
        hc.log("no mesh mapped yet (fill Config/asset_map.json): "
               + ", ".join(f"{k}={n}" for k, n in sorted(skipped.items())))
    hc.log(f"spawned {spawned} instanced point-set actors")
    return spawned


def main(argv=None, cfg=None):
    cfg = cfg or hc.load_config(argv)
    csv_paths = sorted(glob.glob(os.path.join(cfg["city_build"], "pcg", "*.csv")))
    if not csv_paths:
        hc.warn(f"no point sets in {cfg['city_build']}/pcg")
        return 0
    import_tables(cfg, csv_paths)
    n = spawn_instances(csv_paths)
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level()
    return n


if __name__ == "__main__":
    main()
