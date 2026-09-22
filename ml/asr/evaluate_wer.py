"""WER/CER of Whisper on held-out Gram Vaani clips, with or without our LoRA adapter.

    python ml/asr/evaluate_wer.py                      # baseline whisper-small
    python ml/asr/evaluate_wer.py --adapter <ckpt dir> # our fine-tune
"""
import argparse
import json
import sys
import time
from pathlib import Path

import jiwer
import torch
from torch.utils.data import DataLoader
from transformers import WhisperForConditionalGeneration, WhisperProcessor

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import CKPT, HOME  # noqa: E402
from asr.data import ClipDataset, load_split, make_collate, normalize  # noqa: E402

_LOCAL = HOME / "models" / "whisper-small"
BASE = str(_LOCAL) if (_LOCAL / "model.safetensors").exists() else "openai/whisper-small"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--adapter", default=None)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--batch", type=int, default=8)
    a = ap.parse_args()

    dev = "cuda" if torch.cuda.is_available() else "cpu"
    proc = WhisperProcessor.from_pretrained(BASE, language="hindi", task="transcribe")
    model = WhisperForConditionalGeneration.from_pretrained(BASE, dtype=torch.float16 if dev == "cuda" else torch.float32)
    if a.adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, a.adapter).merge_and_unload()
    model.to(dev).eval()

    ds = ClipDataset(load_split("test", a.limit), proc)
    dl = DataLoader(ds, batch_size=a.batch, collate_fn=make_collate(proc, model.config.decoder_start_token_id))
    refs, hyps = [], []
    t0 = time.time()
    for batch in dl:
        with torch.no_grad():
            out = model.generate(
                input_features=batch["input_features"].to(dev, model.dtype),
                language="hi", task="transcribe", max_new_tokens=225,
            )
        hyps += [normalize(t) for t in proc.batch_decode(out, skip_special_tokens=True)]
        refs += batch["text"]
        print(f"{len(refs)}/{len(ds)}", end="\r", flush=True)

    pairs = [(r, h if h else "∅") for r, h in zip(refs, hyps)]
    wer = jiwer.wer([r for r, _ in pairs], [h for _, h in pairs])
    cer = jiwer.cer([r for r, _ in pairs], [h for _, h in pairs])
    name = Path(a.adapter).name if a.adapter else "whisper-small (no fine-tune)"
    res = {"model": name, "clips": len(refs), "wer": round(wer, 4), "cer": round(cer, 4),
           "seconds": round(time.time() - t0, 1)}
    print("\n" + json.dumps(res, ensure_ascii=False))
    out = CKPT / "asr_eval"
    out.mkdir(exist_ok=True)
    tag = Path(a.adapter).name if a.adapter else "baseline"
    (out / f"{tag}.json").write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    with open(out / f"{tag}_samples.tsv", "w", encoding="utf-8") as f:
        f.write("reference\thypothesis\n")
        for r, h in zip(refs, hyps):
            f.write(f"{r}\t{h}\n")


if __name__ == "__main__":
    main()
