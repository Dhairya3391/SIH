"""LoRA fine-tune of whisper-small on Gram Vaani rural Hindi phone audio.

Sized for a 4 GB laptop GPU: fp16 autocast, gradient checkpointing, small
micro-batches with accumulation.

    python ml/asr/train_whisper_lora.py --epochs 2
"""
import argparse
import json
import math
import sys
import time
from pathlib import Path

import torch
from peft import LoraConfig, get_peft_model
from torch.utils.data import DataLoader
from transformers import WhisperForConditionalGeneration, WhisperProcessor, get_linear_schedule_with_warmup

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import CKPT, HOME  # noqa: E402
from asr.data import ClipDataset, load_split, make_collate  # noqa: E402

_LOCAL = HOME / "models" / "whisper-small"
BASE = str(_LOCAL) if (_LOCAL / "model.safetensors").exists() else "openai/whisper-small"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=float, default=2)
    ap.add_argument("--micro-batch", type=int, default=4)
    ap.add_argument("--accum", type=int, default=4)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--out", default=str(CKPT / "whisper-small-gramvaani-lora"))
    a = ap.parse_args()
    torch.manual_seed(0)

    dev = "cuda"
    proc = WhisperProcessor.from_pretrained(BASE, language="hindi", task="transcribe")
    model = WhisperForConditionalGeneration.from_pretrained(BASE)
    model.config.forced_decoder_ids = None
    model.generation_config.language = "hi"
    model.generation_config.task = "transcribe"
    model.config.use_cache = False
    model.gradient_checkpointing_enable()
    model.enable_input_require_grads()
    model = get_peft_model(model, LoraConfig(
        r=32, lora_alpha=64, lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "out_proj"],
    ))
    model.print_trainable_parameters()
    model.to(dev)

    ds = ClipDataset(load_split("train", a.limit), proc)
    dl = DataLoader(ds, batch_size=a.micro_batch, shuffle=True, num_workers=0,
                    collate_fn=make_collate(proc, model.config.decoder_start_token_id))
    total_steps = math.ceil(len(dl) * a.epochs / a.accum)
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=a.lr, weight_decay=0.01)
    sched = get_linear_schedule_with_warmup(opt, int(0.05 * total_steps), total_steps)
    scaler = torch.amp.GradScaler("cuda")
    print(f"clips={len(ds)} micro_batches/epoch={len(dl)} optimizer_steps={total_steps}", flush=True)

    log = []
    step, micro, t0, running = 0, 0, time.time(), 0.0
    model.train()
    while step < total_steps:
        for batch in dl:
            with torch.autocast("cuda", dtype=torch.float16):
                loss = model(input_features=batch["input_features"].to(dev),
                             labels=batch["labels"].to(dev)).loss / a.accum
            scaler.scale(loss).backward()
            running += loss.item()
            micro += 1
            if micro % a.accum:
                continue
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(opt)
            scaler.update()
            opt.zero_grad(set_to_none=True)
            sched.step()
            step += 1
            if step % 10 == 0:
                rec = {"step": step, "of": total_steps, "loss": round(running / 10, 4),
                       "lr": sched.get_last_lr()[0], "min": round((time.time() - t0) / 60, 1)}
                log.append(rec)
                print(json.dumps(rec), flush=True)
                running = 0.0
            if step % 200 == 0:
                model.save_pretrained(a.out)
            if step >= total_steps:
                break

    model.save_pretrained(a.out)
    proc.save_pretrained(a.out)
    Path(a.out, "train_log.json").write_text(json.dumps(log, indent=1))
    print("saved", a.out)


if __name__ == "__main__":
    main()
