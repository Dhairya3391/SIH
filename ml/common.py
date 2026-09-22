"""Shared paths. Heavy files stay outside OneDrive."""
import os
from pathlib import Path

HOME = Path(os.environ.get("JS_ML_HOME", r"C:\Users\rkgaj\jharsetu-ml"))
DATA = HOME / "data"
CKPT = HOME / "checkpoints"
REPO_ML = Path(__file__).resolve().parent

os.environ.setdefault("HF_HOME", str(HOME / "hf_cache"))
for p in (DATA, CKPT):
    p.mkdir(parents=True, exist_ok=True)
