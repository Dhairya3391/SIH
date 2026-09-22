"""Segmented, resumable downloader for a slow connection that caps each stream.

Splits a file into N byte ranges fetched in parallel; each part resumes where
it stopped, so a dropped connection never restarts a 2.6 GB file.

    python ml/tools/fetch.py URL OUT [--parts 8]
    python ml/tools/fetch.py --list jobs.txt [--parts 8]   # lines: URL<TAB>OUT
"""
import argparse
import os
import sys
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

UA = {"User-Agent": "jharsetu-fetch/1.0"}
CHUNK = 1 << 16


def final_url_and_size(url: str) -> tuple[str, int]:
    req = urllib.request.Request(url, headers={**UA, "Range": "bytes=0-0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        total = int(r.headers["Content-Range"].split("/")[-1])
        return r.geturl(), total


def fetch_part(url: str, part: Path, start: int, end: int, progress: dict, key: int) -> None:
    want = end - start + 1
    for attempt in range(1000):
        have = part.stat().st_size if part.exists() else 0
        progress[key] = have
        if have >= want:
            return
        try:
            req = urllib.request.Request(url, headers={**UA, "Range": f"bytes={start + have}-{end}"})
            with urllib.request.urlopen(req, timeout=60) as r, open(part, "ab") as f:
                while True:
                    buf = r.read(CHUNK)
                    if not buf:
                        break
                    f.write(buf)
                    progress[key] += len(buf)
        except Exception as e:  # noqa: BLE001 - any network error: back off and resume
            time.sleep(min(60, 2 + attempt * 2))
            if "403" in str(e) or "expired" in str(e).lower():
                raise
    raise RuntimeError(f"gave up on {part}")


def fetch(url: str, out: Path, parts: int) -> None:
    out = Path(out)
    if out.exists():
        print(f"[skip] {out.name} already complete", flush=True)
        return
    out.parent.mkdir(parents=True, exist_ok=True)
    real, total = final_url_and_size(url)
    n = max(1, min(parts, total // (4 << 20)))  # no part smaller than 4 MB
    step = total // n
    ranges = [(i * step, total - 1 if i == n - 1 else (i + 1) * step - 1) for i in range(n)]
    tmp = [out.with_name(f"{out.name}.part{i}") for i in range(n)]
    progress: dict[int, int] = {}
    done = threading.Event()

    def report():
        t0, b0 = time.time(), sum(progress.values())
        while not done.wait(15):
            got = sum(progress.values())
            rate = (got - b0) / max(1e-9, time.time() - t0)
            eta = (total - got) / rate / 60 if rate else float("inf")
            print(f"  {out.name}: {got / 1e6:,.0f}/{total / 1e6:,.0f} MB  {rate / 1e3:,.0f} KB/s  ETA {eta:,.0f} min", flush=True)

    threading.Thread(target=report, daemon=True).start()
    print(f"[get] {out.name} {total / 1e6:,.0f} MB in {n} parts", flush=True)
    # Signed redirect URLs (Hugging Face) can expire; parts re-resolve from the original.
    with ThreadPoolExecutor(n) as ex:
        futs = [ex.submit(fetch_part, real, tmp[i], a, b, progress, i) for i, (a, b) in enumerate(ranges)]
        for f in futs:
            try:
                f.result()
            except Exception:  # noqa: BLE001
                real, _ = final_url_and_size(url)
    for i, (a, b) in enumerate(ranges):  # re-run any part that failed on an expired link
        fetch_part(real, tmp[i], a, b, progress, i)
    done.set()

    partial = out.with_name(out.name + ".joining")
    with open(partial, "wb") as w:
        for p in tmp:
            with open(p, "rb") as r:
                while buf := r.read(1 << 22):
                    w.write(buf)
    if partial.stat().st_size != total:
        raise RuntimeError(f"size mismatch for {out}: {partial.stat().st_size} != {total}")
    os.replace(partial, out)
    for p in tmp:
        p.unlink()
    print(f"[ok] {out}", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("url", nargs="?")
    ap.add_argument("out", nargs="?")
    ap.add_argument("--list")
    ap.add_argument("--parts", type=int, default=8)
    a = ap.parse_args()
    jobs = [l.split("\t") for l in Path(a.list).read_text().splitlines() if l.strip()] if a.list else [(a.url, a.out)]
    for url, out in jobs:
        fetch(url.strip(), Path(out.strip()), a.parts)
    print("ALL DONE", flush=True)
    sys.exit(0)
