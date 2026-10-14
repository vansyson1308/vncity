"""pipeline.subset cuts a district out of a fetched cache by geometry bbox, offline."""

import json

import duckdb
import shapely
from shapely import wkb

from fetch import load_extensions
from pipeline import subset


def write_layer(con, path, geoms):
    rows = [(f"id{i}", wkb.dumps(g)) for i, g in enumerate(geoms)]
    con.execute("CREATE OR REPLACE TABLE t (id VARCHAR, wkb BLOB)")
    con.executemany("INSERT INTO t VALUES (?, ?)", rows)
    con.sql(f"COPY t TO '{path}' (FORMAT parquet)")


def test_subset_keeps_only_features_touching_the_bbox(tmp_path):
    src, dst = tmp_path / "big", tmp_path / "small"
    src.mkdir()
    con = duckdb.connect()
    load_extensions(con, "spatial")
    inside = shapely.box(105.81, 21.03, 105.812, 21.032)
    crossing = shapely.LineString([(105.79, 21.03), (105.83, 21.03)])  # touches the box, longer than it
    outside = shapely.box(105.90, 21.09, 105.91, 21.10)
    write_layer(con, src / "buildings.parquet", [inside, outside])
    write_layer(con, src / "roads.parquet", [crossing, outside])
    (src / "dem_N21_E105.tif").write_bytes(b"not really a tif")
    (src / "fetch.json").write_text(json.dumps({"name": "big", "bbox": [105.72, 20.93, 105.95, 21.12],
                                                "overture_release": "2026-09-23.0", "dem_tiles": ["dem_N21_E105.tif"]}))
    meta = subset.subset(src, dst, (105.80, 21.02, 105.85, 21.05), con)
    assert meta["buildings"] == 1 and meta["road_segments"] == 1
    assert meta["subset_of"] == "big" and meta["bbox"] == [105.80, 21.02, 105.85, 21.05]
    assert (dst / "dem_N21_E105.tif").read_bytes() == b"not really a tif"
    assert json.loads((dst / "fetch.json").read_text())["overture_release"] == "2026-09-23.0"
    kept = con.sql(f"SELECT id FROM '{dst / 'roads.parquet'}'").fetchall()
    assert kept == [("id0",)]  # the crossing road is kept whole; clipping happens at build time


def test_subset_refuses_a_bbox_outside_the_cache(tmp_path):
    src = tmp_path / "big"
    src.mkdir()
    (src / "fetch.json").write_text(json.dumps({"name": "big", "bbox": [105.8, 21.0, 105.9, 21.1],
                                                "overture_release": "x", "dem_tiles": []}))
    import pytest
    with pytest.raises(SystemExit):
        subset.subset(src, tmp_path / "small", (105.7, 21.0, 105.85, 21.05))
