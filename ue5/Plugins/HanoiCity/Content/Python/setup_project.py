"""One-shot project setup: content DataTables, city tiles, runtime data, PCG points.

Run in the editor (after the C++ has built):
  Tools > Hanoi City > Run Full Setup
  or Output Log (Python):  py setup_project.py --city ../out/hoankiem [--max-tiles 20]
Re-running is safe: assets are replaced, actors under City/* are respawned.
Defaults come from Config/hanoi_setup.json.
"""

import time
import traceback

import hanoi_common as hc
import import_city
import import_content
import import_pcg_points


def main(argv=None):
    cfg = hc.load_config(argv)
    hc.log(f"setup: city={cfg['city_build']} content={cfg['game_content']}")
    steps = []
    if not cfg.get("skip_content"):
        steps.append(("content DataTables", import_content.main))
    steps.append(("city tiles + traffic + markers", import_city.main))
    if not cfg.get("skip_points"):
        steps.append(("PCG point sets", import_pcg_points.main))
    report = []
    for name, fn in steps:
        t0 = time.time()
        try:
            result = fn(cfg=cfg)
            report.append(f"OK    {name} ({time.time() - t0:.0f}s): {result}")
        except Exception:
            hc.error(traceback.format_exc())
            report.append(f"FAIL  {name}: see Output Log")
    hc.log("setup summary:\n  " + "\n  ".join(report))
    hc.log("next: run the first-open checklist in docs/05-tich-hop-ue5.md (axis markers, PIE clock/sun)")
    return report


if __name__ == "__main__":
    main()
