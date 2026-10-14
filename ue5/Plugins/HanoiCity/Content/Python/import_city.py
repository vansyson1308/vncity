"""out/<city>/ -> level: georeference, building/road tiles, traffic graph, landmark markers.

Axis conversion (the part to verify on first open):
  pipeline ENU metres (x east, y north, z up)
  glTF tile  : X = east, Y = up, Z = -north, node translation = (ox, 0, -oy) tile offset
  UE world   : X = east, Y = south, Z = up, centimetres:  UE = (100 x, -100 y, 100 z)
  i.e. UE.X = 100 glTF.X, UE.Y = 100 glTF.Z, UE.Z = 100 glTF.Y  (a Y/Z swap, which is also the
  handedness flip). That is what UE's glTF importers are expected to do, but instead of trusting
  it, this script measures up to 16 imported tiles (mesh bounds vs. the tile's known building
  extent from semantics/footprints_X_Y.json) and solves all of them jointly with
  hanoi_geo.solve_mapping, then derives the actor transform (yaw, mirror, unit scale, whether the
  node offset was baked). The decision is logged; it must read
  "units=100.0 baked=True map=((1, 0), (0, -1))" for the expected importer behaviour.
  Then check the landmark markers spawned under City/Verify sit on the right buildings.

Usage: Tools > Hanoi City > Import City Tiles, or py import_city.py --city ../out/hoankiem
"""

import glob
import json
import math
import os
import shutil

import unreal

import hanoi_common as hc
import hanoi_geo

# Independent reference points (WGS84) for the on-first-open check.
VERIFY_POINTS = [
    ("Thap Rua (Turtle Tower islet, Ho Guom)", 21.02781, 105.85231),
    ("Nha hat Lon (Opera House)", 21.02430, 105.85760),
    ("Nha tho Lon (St Joseph's Cathedral)", 21.02870, 105.84900),
]


def ensure_map(cfg):
    les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    path = cfg["map"]
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        les.load_level(path)
        return
    if not les.new_level_from_template(path, cfg["map_template"]):
        hc.warn(f"could not create {path} from {cfg['map_template']}; create File > New Level > "
                f"Open World, save it as {path}, and re-run")
        les.new_level(path)
    hc.log(f"created level {path}")


def tile_expected_box(tm, tiles_dir, key, origin, size):
    """Plan box (e0, e1, n0, n1) of one tile's building mesh in ENU metres.

    Exact when semantics/footprints_X_Y.json exists (the mesh is extruded from those outlines,
    including footprints that straddle the tile edge); otherwise the building centroids of
    tiles/bld_X_Y.json padded by a typical half footprint.
    """
    fp = os.path.join(os.path.dirname(os.path.normpath(tiles_dir)), "semantics",
                      f"footprints_{key[0]}_{key[1]}.json")
    try:
        with open(fp, encoding="utf-8") as f:
            outlines = [b["outline"] for b in json.load(f)["buildings"] if b.get("outline")]
        vs = [v for o in outlines for v in o]
        if len(outlines) >= 8:
            xs, ys = [v[0] for v in vs], [v[1] for v in vs]
            return (min(xs), max(xs), min(ys), max(ys))
    except (OSError, KeyError, ValueError, TypeError, IndexError):
        pass
    path = os.path.join(tiles_dir, f"bld_{key[0]}_{key[1]}.json")
    try:
        with open(path, encoding="utf-8") as f:
            blds = json.load(f)["buildings"]
    except (OSError, KeyError, ValueError):
        return None
    pts = [tm.forward(b["lat"], b["lon"]) for b in blds if "lat" in b and "lon" in b]
    if len(pts) < 8:
        return None
    # Centroids are inside the footprints, so pad by a typical half footprint.
    pad = 8.0
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return (min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad)


def import_glb(path, dest):
    """Import one .glb into its own folder dest; return the StaticMesh assets it produced.

    The result is read from the task (imported_object_paths, or get_objects() which Interchange
    fills), falling back to listing dest, which only ever holds this one file's assets.
    """
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", path)
    task.set_editor_property("destination_path", dest)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("save", False)
    hc.asset_tools().import_asset_tasks([task])
    objects = []
    for obj_path in task.get_editor_property("imported_object_paths") or []:
        objects.append(unreal.EditorAssetLibrary.load_asset(obj_path))
    if not objects and hasattr(task, "get_objects"):
        objects = list(task.get_objects() or [])
    if not objects:
        objects = [unreal.EditorAssetLibrary.load_asset(p)
                   for p in unreal.EditorAssetLibrary.list_assets(dest, recursive=True, include_folder=False)]
    meshes = [a for a in objects if isinstance(a, unreal.StaticMesh)]
    if not meshes:
        hc.warn(f"{os.path.basename(path)}: the importer produced no StaticMesh in {dest}")
    return meshes


def prepare_mesh(mesh, nanite):
    if nanite:
        try:
            settings = mesh.get_editor_property("nanite_settings")
            settings.set_editor_property("enabled", True)
            mesh.set_editor_property("nanite_settings", settings)
        except Exception as e:
            hc.warn(f"Nanite not enabled on {mesh.get_name()}: {e}")
    try:  # buildings are static: use the render mesh for collision
        body = mesh.get_editor_property("body_setup")
        body.set_editor_property("collision_trace_flag", unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
    except Exception as e:
        hc.warn(f"collision flag not set on {mesh.get_name()}: {e}")


def mesh_bounds(mesh):
    box = mesh.get_bounding_box()
    mn, mx = box.get_editor_property("min"), box.get_editor_property("max")
    return (mn.x, mn.y, mn.z), (mx.x, mx.y, mx.z)


def place(mesh, placement, label, folder):
    loc = unreal.Vector(*placement["location"])
    rot = unreal.Rotator(roll=0.0, pitch=0.0, yaw=placement["yaw"])
    actor = hc.actor_subsystem().spawn_actor_from_object(mesh, loc, rot)
    actor.set_actor_scale3d(unreal.Vector(*placement["scale"]))
    actor.set_actor_label(label)
    actor.set_folder_path(folder)
    return actor


def calibrate(samples):
    """Joint solve over the sampled tiles -> (map, units, baked). samples: hanoi_geo.solve_mapping input."""
    r = hanoi_geo.solve_mapping(samples)
    m, units, baked, scores = r["map"], r["units"], r["baked"], r["scores"]
    hc.log(f"importer axis calibration: units={units} baked={baked} map={m} "
           f"({len(samples)} tiles, IoU {min(scores):.2f}-{max(scores):.2f}, "
           f"total {r['total']:.2f} vs runner-up {r['runner_up'][1]:.2f} {r['runner_up'][0]})")
    if (m, units, baked) != (((1, 0), (0, -1)), 100.0, True):
        hc.warn("importer did not behave as expected (see docs/05-tich-hop-ue5.md, axis check); "
                "corrected via actor transforms")
    if min(scores) < 0.6 or r["total"] - r["runner_up"][1] < 0.05 * len(samples):
        hc.warn("axis calibration is ambiguous: inspect the City/Verify markers carefully")
    return m, units, baked


def import_tiles(cfg, manifest):
    city = cfg["city_build"]
    tiles_dir = os.path.join(city, "tiles")
    geo = manifest["georeference"]
    tm = hanoi_geo.TransverseMercator(geo["origin_lat"], geo["origin_lon"])
    size = float(manifest["tile_size_m"])
    tiles = sorted(manifest["tiles"], key=lambda t: math.hypot(t["origin_m"][0] + size / 2, t["origin_m"][1] + size / 2))
    if cfg.get("max_tiles"):
        tiles = tiles[: cfg["max_tiles"]]
    hc.remove_actors_in_folder("City/Buildings")
    hc.remove_actors_in_folder("City/Roads")

    imported = []  # (kind, key, origin, meshes, expected_box)
    with unreal.ScopedSlowTask(len(tiles), "Importing city tiles") as task:
        task.make_dialog(True)
        for t in tiles:
            if task.should_cancel():
                break
            task.enter_progress_frame(1, f"tile {t['key']}")
            key = t["key"]
            folder_key = f"{key[0]}_{key[1]}".replace("-", "m")
            for kind in ("bld", "road"):
                if kind == "road" and not cfg.get("import_roads", True):
                    continue
                fname = f"{kind}_{key[0]}_{key[1]}.glb"
                if fname not in t.get("files", []):
                    continue
                meshes = import_glb(os.path.join(tiles_dir, fname),
                                    f"{cfg['tiles_dest']}/{folder_key}/{kind}")
                for m in meshes:
                    prepare_mesh(m, cfg.get("nanite", True) and kind == "bld")
                box = tile_expected_box(tm, tiles_dir, key, t["origin_m"], size) if kind == "bld" else None
                imported.append((kind, key, t["origin_m"], meshes, box))

    samples = []
    for kind, key, origin, meshes, box in imported:
        if kind == "bld" and box and len(meshes) == 1 and len(samples) < 16:
            mn, mx = mesh_bounds(meshes[0])
            samples.append((mn, mx, origin, box))
    if not samples:
        hc.warn("no tile suitable for axis calibration; assuming the contract mapping")
        mapping = (((1, 0), (0, -1)), 100.0, True)
    else:
        mapping = calibrate(samples)

    count = 0
    for kind, key, origin, meshes, _ in imported:
        placement = hanoi_geo.placement_from_mapping(mapping[0], mapping[1], mapping[2], origin)
        folder = "City/Buildings" if kind == "bld" else "City/Roads"
        for m in meshes:
            place(m, placement, f"{kind}_{key[0]}_{key[1]}", folder)
            count += 1
    unreal.EditorAssetLibrary.save_directory(cfg["tiles_dest"], only_if_is_dirty=True, recursive=True)
    hc.log(f"placed {count} tile actors from {len(tiles)} tiles")
    return count


def copy_runtime_data(cfg, manifest):
    """Files the runtime reads directly (staged as UFS, see DefaultGame.ini)."""
    city = cfg["city_build"]
    dest = os.path.join(hc.content_dir(), "Data", "City")
    copied = []
    for rel in ("traffic/graph.json", "places/pois.json", "districts.geojson", "manifest.json"):
        src = os.path.join(city, rel)
        if os.path.exists(src):
            os.makedirs(os.path.dirname(os.path.join(dest, rel)), exist_ok=True)
            shutil.copyfile(src, os.path.join(dest, rel))
            copied.append(rel)
    hc.log(f"runtime data copied to {dest}: {copied}")
    return copied


def ensure_traffic_graph():
    sub = hc.actor_subsystem()
    existing = [a for a in sub.get_all_level_actors() if isinstance(a, unreal.HanoiTrafficGraph)]
    actor = existing[0] if existing else sub.spawn_actor_from_class(unreal.HanoiTrafficGraph, unreal.Vector(0, 0, 0))
    actor.set_actor_label("HanoiTrafficGraph")
    actor.set_folder_path("City/Systems")
    hc.set_spatially_loaded(actor, False)  # must stay loaded with World Partition
    if not actor.load_graph():
        hc.warn("traffic graph failed to load (see Output Log)")
    return actor


def spawn_verify_markers(cfg, manifest):
    """Text markers at known WGS84 points + content landmarks, to eyeball the georeference."""
    hc.remove_actors_in_folder("City/Verify")
    geo = manifest["georeference"]
    tm = hanoi_geo.TransverseMercator(geo["origin_lat"], geo["origin_lon"])
    points = list(VERIFY_POINTS)
    lm_dir = cfg["game_content"]
    for path in glob.glob(os.path.join(lm_dir, "**", "*.json"), recursive=True):
        try:
            with open(path, encoding="utf-8") as f:
                doc = json.load(f)
        except ValueError:
            continue
        if isinstance(doc, dict) and doc.get("collection") == "landmarks":
            for it in doc.get("items", []):
                loc = it.get("location")
                if loc and "lat" in loc and "lon" in loc:
                    label = (it.get("name") or {}).get("vi") or it.get("id", "?")
                    points.append((label, loc["lat"], loc["lon"]))
    sub = hc.actor_subsystem()
    for label, lat, lon in points:
        x, y = tm.forward(lat, lon)
        ue = hanoi_geo.enu_to_ue(x, y, 40.0)
        actor = sub.spawn_actor_from_class(unreal.TextRenderActor, unreal.Vector(*ue))
        comp = actor.get_editor_property("text_render")
        comp.set_editor_property("text", label)
        comp.set_editor_property("world_size", 600.0)
        try:
            comp.set_editor_property("horizontal_alignment", unreal.HorizTextAligment.EHTA_CENTER)
        except Exception:
            pass  # cosmetic
        actor.set_actor_label(f"Verify_{label[:40]}")
        actor.set_folder_path("City/Verify")
        hc.set_spatially_loaded(actor, False)
        hc.log(f"verify marker {label}: lat/lon {lat:.5f},{lon:.5f} -> UE {ue[0]:.0f},{ue[1]:.0f}")
    return len(points)


def main(argv=None, cfg=None):
    cfg = cfg or hc.load_config(argv)
    manifest = hc.load_manifest(cfg)
    geo = manifest["georeference"]
    if not unreal.HanoiCityEditorLibrary.set_city_origin(geo["origin_lat"], geo["origin_lon"], geo.get("origin_height_m", 0.0)):
        hc.warn("could not write the origin to DefaultGame.ini (is the file read-only?)")
    ensure_map(cfg)
    result = {"tiles": 0}
    if not cfg.get("skip_tiles"):
        result["tiles"] = import_tiles(cfg, manifest)
    result["runtime_data"] = copy_runtime_data(cfg, manifest)
    if os.path.exists(os.path.join(hc.content_dir(), "Data", "City", "traffic", "graph.json")):
        ensure_traffic_graph()
    result["markers"] = spawn_verify_markers(cfg, manifest)
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level()
    return result


if __name__ == "__main__":
    main()
