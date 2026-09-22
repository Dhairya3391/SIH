"""Download a subset of Gram Vaani Hindi (rural phone recordings).

Reads only the `audio` and `transcription` columns straight from the remote
parquet files (skipping the mirror's precomputed features, ~23% of each file),
several shards in parallel because this connection caps each stream. A shard
already on disk is skipped, so the script can be re-run after a drop.

    python ml/asr/download_gramvaani.py --train-shards 7 --test-shards 1
"""
import argparse
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import pyarrow.parquet as pq
from huggingface_hub import HfFileSystem

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import DATA  # noqa: E402

TRAIN_REPO = "datasets/TheAIchemist13/gramvaani_preprocessed_hi_train"
TEST_REPO = "datasets/TheAIchemist13/gramvaani_preprocessed_hi_test"
OUT = DATA / "gramvaani"
COLS = ["audio", "transcription"]


def one(fs: HfFileSystem, remote: str, dest: Path) -> str:
    if dest.exists():
        return f"[skip] {dest.name}"
    for attempt in range(20):
        try:
            t0 = time.time()
            with fs.open(remote, block_size=8 << 20) as f:
                table = pq.read_table(f, columns=COLS)
            tmp = dest.with_suffix(".tmp")
            pq.write_table(table, tmp)
            tmp.replace(dest)
            return f"[ok] {dest.parent.name}/{dest.name}: {table.num_rows} clips in {(time.time() - t0) / 60:.1f} min"
        except Exception as e:  # noqa: BLE001 - network drop: back off and retry the shard
            print(f"  retry {dest.name} ({attempt + 1}): {e}", flush=True)
            time.sleep(10 + 10 * attempt)
    raise RuntimeError(f"gave up on {remote}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train-shards", type=int, default=7)
    ap.add_argument("--test-shards", type=int, default=1)
    ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()
    fs = HfFileSystem()
    jobs = []
    for repo, split, n in ((TEST_REPO, "test", a.test_shards), (TRAIN_REPO, "train", a.train_shards)):
        files = sorted(p for p in fs.ls(f"{repo}/data", detail=False) if p.endswith(".parquet"))[:n]
        (OUT / split).mkdir(parents=True, exist_ok=True)
        jobs += [(p, OUT / split / f"{i:03d}.parquet") for i, p in enumerate(files)]
    print(f"{len(jobs)} shards -> {OUT}", flush=True)
    with ThreadPoolExecutor(a.workers) as ex:
        for fut in as_completed([ex.submit(one, fs, p, d) for p, d in jobs]):
            print(fut.result(), flush=True)
    print("ALL DONE", flush=True)


if __name__ == "__main__":
    main()
