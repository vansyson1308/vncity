"""game/content/**.json -> DataTables /Game/Hanoi/Data/DT_<collection>.

1. Runs tools/codegen_ue.py's converter (same code as on the command line) to write
   DataTable-import JSON into <project>/Data/Generated/ (gitignored build product).
2. Creates/updates one DataTable per collection with the generated row struct
   (FHanoi<Name>Row from Generated/HanoiContentTypes.h) and fills it from that JSON.

If a collection's struct is missing, the C++ was built from an older schema: run
`python tools/codegen_ue.py`, rebuild the editor, then re-run.

Usage in the editor: Tools > Hanoi City > Reimport Game Content, or
  py import_content.py [--content ../game/content]
"""

import os

import unreal

import hanoi_common as hc


def main(argv=None, cfg=None):
    cfg = cfg or hc.load_config(argv)
    codegen = hc.load_codegen(cfg)
    schemas = os.path.join(os.path.dirname(os.path.dirname(cfg["codegen"])), "game", "schemas")
    model = codegen.build_model(schemas)
    stale = not os.path.exists(codegen.HEADER_PATH) or \
        open(codegen.HEADER_PATH, encoding="utf-8").read() != codegen.render_header(model)
    if stale:
        hc.warn("Generated/HanoiContentTypes.h is stale vs game/schemas: run tools/codegen_ue.py "
                "and rebuild, or new fields will be missing")
    manifest = codegen.convert_content(model, cfg["game_content"], cfg["data_json_out"])
    folder = cfg["data_dest"]
    done = {}
    for col, info in sorted(manifest["collections"].items()):
        struct = hc.script_struct(info["row_struct"])
        if struct is None:
            hc.error(f"{col}: row struct {info['row_struct']} not found (rebuild C++ after codegen)")
            continue
        name = f"DT_{col}"
        table = hc.ensure_data_table(folder, name, struct)
        json_path = os.path.join(cfg["data_json_out"], info["file"])
        ok = unreal.DataTableFunctionLibrary.fill_data_table_from_json_file(table, json_path, struct)
        rows = len(unreal.DataTableFunctionLibrary.get_data_table_row_names(table))
        if not ok or rows != info["rows"]:
            hc.error(f"{col}: imported {rows}/{info['rows']} rows from {json_path} (see Output Log)")
        unreal.EditorAssetLibrary.save_asset(f"{folder}/{name}", only_if_is_dirty=False)
        done[col] = rows
    hc.log(f"content: {sum(done.values())} rows in {len(done)} DataTables under {folder}")
    return done


if __name__ == "__main__":
    main()
