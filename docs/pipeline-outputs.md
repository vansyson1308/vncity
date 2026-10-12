# Pipeline output contract

This is the contract between the Python city pipeline and the UE5 harness. Everything here is
engine-agnostic. The harness is the only place that knows Unreal's axes and units.

## Coordinates

All pipeline geometry is **ENU metres** (x = east, y = north, z = up) in a local transverse
Mercator projection centred on `manifest.georeference.origin_lat/origin_lon` of the city build.
Yaw angles are **degrees counter-clockwise from east** (math convention).

Conversion to Unreal (left-handed, Z up, centimetres), matching Cesium for Unreal's convention
of X = east, Y = south:

```
UE.X = x * 100
UE.Y = -y * 100
UE.Z = z * 100
UE.Yaw = -yaw_deg
```

glTF tiles from `build.py` use glTF axes (X = east, Y = up, Z = -north) with the tile offset in
the node translation; the importer must land them on the same UE frame as above.

## Files under `out/<name>/`

| Path | Producer | Content |
| --- | --- | --- |
| `manifest.json` | build.py | georeference, tile index, provenance stats; `layers` lists the files below |
| `tiles/bld_X_Y.glb`, `tiles/road_X_Y.glb` | build.py | massing meshes |
| `tiles/bld_X_Y.json` | build.py | per-building attributes (`id`, `height_m`, `face_start`, …) |
| `semantics/footprints_X_Y.json` | pipeline/semantics.py | per-building footprint + archetype + frontage, see below |
| `pcg/<set>.csv` | pipeline/scatter.py | point sets for UE PCG / instancing |
| `traffic/graph.json` | pipeline/traffic.py | drivable road graph for traffic AI |
| `places/pois.json` | pipeline/semantics.py | named places (shops, cafés, temples…) with category |
| `districts.geojson` | pipeline/fetch_context.py | district / ward polygons (WGS84) |

### `semantics/footprints_X_Y.json`

```json
{"tile": [ix, iy], "origin_m": [ox, oy], "buildings": [
  {"id": "overture id", "archetype": "nha_ong_pho_co", "district": "hoan_kiem",
   "base_m": 0.0, "height_m": 13.2, "floors": 4, "area_m2": 62.0,
   "outline": [[x, y], ...],            // ENU metres, absolute (not tile-relative), CCW, open ring
   "frontage": [ {"a": [x, y], "b": [x, y], "length_m": 4.1, "road_class": "residential",
                  "road_name": "Hàng Bạc", "facing_deg": 271.0} ],
   "pois": ["place id", ...]}
]}
```

`archetype` ids are the ids in `game/content/world/building_archetypes.json`.
`frontage` lists the outline edges that face a street within 12 m; `facing_deg` is the outward
normal of the edge (yaw convention above). Facade kits put the shopfront on these edges.

### `pcg/<set>.csv`

One row per instance. Header:

```
Name,X,Y,Z,Yaw,Scale,Set,Kind,Variant,Seed,Tile,Ref
```

* `X,Y,Z` ENU metres (absolute in the city frame), `Yaw` degrees CCW from east.
* `Set` is the file stem (`shop_signs`, `street_trees`, `power_poles`, `parked_motorbikes`,
  `street_vendors`, `street_lights`, `cable_spans`, …), `Kind` the asset family inside the set,
  `Variant` an integer for mesh/material variation, `Seed` a stable integer per row.
* `Tile` is `ix_iy` of the build tile, so World Partition / streaming can bucket rows.
* `Ref` optional id (building id, place id, road id) the instance belongs to.
* `Name` is a unique row name so the CSV imports directly into a UE DataTable.

### `traffic/graph.json`

```json
{"nodes": [{"id": 0, "x": 0.0, "y": 0.0, "z": 0.0, "signal": false}],
 "edges": [{"id": 0, "from": 0, "to": 1, "road_id": "overture id", "name": "Đinh Tiên Hoàng",
            "class": "secondary", "oneway": false, "lanes": 2, "width_m": 12.0,
            "speed_kmh": 40, "motorbike_only": false, "length_m": 85.3,
            "polyline": [[x, y], ...]}]}
```

Edges are directed only when `oneway` is true; otherwise traversable both ways.
