"""Write Python's probabilities for the frozen test texts, so the TypeScript port
can be checked against them (backend/scripts/check-classifier-parity.ts).

Rebuilds the vectoriser from the exported JSON, so it checks the file that ships.
"""
import json
import sys
import unicodedata
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import REPO_ML  # noqa: E402

EXPORT = REPO_ML.parent / "backend" / "lib" / "ai" / "models" / "report-classifier.json"
OUT = REPO_ML / "classifier" / "parity.json"


def prep(t):
    return unicodedata.normalize("NFC", t).lower()


m = json.loads(EXPORT.read_text(encoding="utf-8"))
vec = TfidfVectorizer(analyzer="char_wb", ngram_range=tuple(m["ngram"]), sublinear_tf=True, preprocessor=prep,
                      vocabulary=m["vocab"])
vec.idf_ = np.array(m["idf"])
texts = [json.loads(l)["text"] for l in (REPO_ML / "classifier" / "testset_v2_frozen.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
X = vec.transform(texts)


def softmax(z):
    z = z - z.max(1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(1, keepdims=True)


rows = []
for i, t in enumerate(texts):
    x = X[i]
    r = {"text": t}
    for h in ("category", "severity", "dm_phase"):
        W = np.array(m["heads"][h]["coef"])
        b = np.array(m["heads"][h]["intercept"])
        r[h] = softmax((x @ W.T) + b)[0].round(6).tolist()
    rows.append(r)
OUT.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
print(f"wrote {len(rows)} rows -> {OUT}")
