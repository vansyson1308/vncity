"""Runs automatically when the editor starts (Python Editor Script Plugin).

Kept light on purpose: only announces the entry points. Heavy work is in setup_project.py.
"""

import unreal

unreal.log("[HanoiCity] editor scripts ready: Tools > Hanoi City, or `py setup_project.py --city ../out/<name>`")
