"""
Stage 1: ingest — download official MHT-CET Engineering CAP cutoff PDFs into a
local raw archive with provenance, so every downstream row is traceable to an
immutable source file.

The State CET Cell hosts per-year cutoff PDFs under the engineering CAP portal at
a stable path pattern (verified for 2023/2024):

    https://fe<portalYear>.mahacet.org/<dataYear>/<dataYear>ENGG_CAP<n>_CutOff.pdf
    https://fe<portalYear>.mahacet.org/<dataYear>/<dataYear>ENGG_CAP<n>_AI_CutOff.pdf   (All-India round)

e.g. 2024 data is served from the fe2025 portal:
    https://fe2025.mahacet.org/2024/2024ENGG_CAP1_CutOff.pdf

Because the portal-year vs data-year offset and exact filenames shift year to
year, URLs are declared in a small registry (SOURCES) that a human updates each
cycle — cheaper and more reliable than scraping the portal's menu system.

Usage:
    python ingest.py --year 2024               # all known rounds for 2024
    python ingest.py --year 2024 --round 1
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone

import requests

ARCHIVE_DIR = os.environ.get("CETWIKI_ARCHIVE", "./archive")

# Per-cycle source registry (verified July 2026). Later portals host several
# past years under /<dataYear>/: fe2025 serves 2021-2024, fe2026 serves 2025.
# For year-over-year trends we take each year's FINAL round (closing cutoffs);
# 2021 ran only to CAP2 (COVID cycle). Earlier rounds/All-India files exist too
# (…ENGG_CAP<n>[_AI]_CutOff.pdf) and can be added here.
SOURCES: dict[int, list[dict]] = {
    2021: [
        {"round": 2, "doc_type": "cutoff", "seats": "MH+MI", "final": True,
         "url": "https://fe2025.mahacet.org/2021/2021ENGG_CAP2_CutOff.pdf"},
    ],
    2022: [
        {"round": 3, "doc_type": "cutoff", "seats": "MH+MI", "final": True,
         "url": "https://fe2025.mahacet.org/2022/2022ENGG_CAP3_CutOff.pdf"},
    ],
    2023: [
        {"round": 3, "doc_type": "cutoff", "seats": "MH+MI", "final": True,
         "url": "https://fe2025.mahacet.org/2023/2023ENGG_CAP3_CutOff.pdf"},
    ],
    2024: [
        {"round": 3, "doc_type": "cutoff", "seats": "MH+MI", "final": True,
         "url": "https://fe2025.mahacet.org/2024/2024ENGG_CAP3_CutOff.pdf"},
    ],
    2025: [
        {"round": 3, "doc_type": "cutoff", "seats": "MH+MI", "final": True,
         "url": "https://fe2026.mahacet.org/2025/2025ENGG_CAP3_CutOff.pdf"},
    ],
}

# Be a polite client and identify ourselves.
HEADERS = {"User-Agent": "CETwiki-ingest/0.1 (research; contact: admin@cetwiki.example)"}


def sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ingest_one(year: int, src: dict) -> dict:
    os.makedirs(os.path.join(ARCHIVE_DIR, str(year)), exist_ok=True)
    fname = f"{year}ENGG_CAP{src['round']}_{src['seats']}.pdf".replace("+", "")
    path = os.path.join(ARCHIVE_DIR, str(year), fname)

    print(f"↓ {src['url']}")
    r = requests.get(src["url"], headers=HEADERS, timeout=120)
    r.raise_for_status()
    if not r.content.startswith(b"%PDF"):
        raise RuntimeError(f"not a PDF (got {r.headers.get('content-type')})")
    with open(path, "wb") as f:
        f.write(r.content)

    record = {
        "year": year,
        "round": src["round"],
        "doc_type": src["doc_type"],
        "seats": src["seats"],
        "source_url": src["url"],
        "storage_path": path,
        "sha256": sha256_of(path),
        "bytes": len(r.content),
        "ingested_at": datetime.now(timezone.utc).isoformat(),
    }
    # Append to the provenance manifest (maps 1:1 to source_documents rows).
    manifest = os.path.join(ARCHIVE_DIR, "manifest.jsonl")
    with open(manifest, "a") as f:
        f.write(json.dumps(record) + "\n")
    print(f"  saved {path} ({record['bytes']:,} bytes, sha {record['sha256'][:12]}…)")
    return record


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--round", type=int)
    args = ap.parse_args()

    srcs = SOURCES.get(args.year, [])
    if args.round:
        srcs = [s for s in srcs if s["round"] == args.round]
    if not srcs:
        raise SystemExit(f"no sources registered for year={args.year} round={args.round}")
    for s in srcs:
        ingest_one(args.year, s)


if __name__ == "__main__":
    main()
