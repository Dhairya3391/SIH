"""Gram Vaani clips -> Whisper inputs, decoded on the fly (no torchcodec needed)."""
import io
import re
import sys
import unicodedata
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
import soundfile as sf
import torch
from torch.utils.data import Dataset

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import DATA  # noqa: E402

SR = 16_000
MAX_SECONDS = 30.0
TAG = re.compile(r"<[^>]*>|\[[^\]]*\]")  # <noise>, [laugh] style markers


def normalize(text: str) -> str:
    """For scoring and training targets. Keeps Devanagari vowel signs, which
    Whisper's BasicTextNormalizer would strip."""
    text = TAG.sub(" ", text or "")
    text = unicodedata.normalize("NFC", text).lower()
    text = "".join(" " if unicodedata.category(c).startswith("P") else c for c in text)
    return " ".join(text.split())


def load_split(split: str, limit: int | None = None) -> list[tuple[bytes, str]]:
    rows: list[tuple[bytes, str]] = []
    for f in sorted((DATA / "gramvaani" / split).glob("*.parquet")):
        t = pq.read_table(f).to_pylist()
        for r in t:
            text = normalize(r["transcription"])
            if text:
                rows.append((r["audio"]["bytes"], text))
        if limit and len(rows) >= limit:
            break
    return rows[:limit] if limit else rows


def decode(b: bytes) -> np.ndarray:
    wav, sr = sf.read(io.BytesIO(b), dtype="float32", always_2d=False)
    if wav.ndim > 1:
        wav = wav.mean(axis=1)
    if sr != SR:
        import librosa
        wav = librosa.resample(wav, orig_sr=sr, target_sr=SR)
    return wav


class ClipDataset(Dataset):
    def __init__(self, rows, processor, max_label_len: int = 200):
        self.processor = processor
        self.items = []
        for b, text in rows:
            ids = processor.tokenizer(text).input_ids
            if len(ids) <= max_label_len:
                self.items.append((b, text, ids))

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        b, text, ids = self.items[i]
        wav = decode(b)[: int(SR * MAX_SECONDS)]
        feats = self.processor.feature_extractor(wav, sampling_rate=SR, return_tensors="np").input_features[0]
        return {"input_features": feats, "labels": ids, "text": text}


def make_collate(processor, decoder_start_token_id: int):
    def collate(batch):
        feats = torch.tensor(np.stack([b["input_features"] for b in batch]))
        lab = processor.tokenizer.pad({"input_ids": [b["labels"] for b in batch]}, return_tensors="pt")
        labels = lab["input_ids"].masked_fill(lab["attention_mask"].ne(1), -100)
        if (labels[:, 0] == decoder_start_token_id).all():
            labels = labels[:, 1:]  # the model prepends the start token itself
        return {"input_features": feats, "labels": labels, "text": [b["text"] for b in batch]}

    return collate
