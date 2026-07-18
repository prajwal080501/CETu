"""
Parse branch-wise SEAT INTAKE from the per-institute CAP Provisional Allotment
PDFs (fe2025.mahacet.org/CAP-I/CAPR-I_<code>.pdf).

PRIVACY: these PDFs also list individual admitted candidates (names, application
ids, scores). We deliberately parse ONLY the aggregate seat header lines and the
branch/institute headers — never a candidate row. No personal data is extracted.

Per branch the doc prints:
    0301224510 - Computer Engineering
    Sanction Intake: 60   CAP Seats: 60   [ MS Seats: 60  Minority Seats : 0  AI Seats: 0 ] Institute Seats 00
    (then EWS/TFWS supernumerary Sanction-Intake lines we skip)

We keep the FIRST Sanction-Intake line per branch (the regular sanctioned intake).

Usage: python parse_intake.py capr/ --out seats.jsonl
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import subprocess
import sys

INST_RE = re.compile(r"^(\d{5})\s+(\D.+?)\s*$")
CHOICE_RE = re.compile(r"^\s*(\d{10})\s*-\s*(.+?)\s*$")
INTAKE_RE = re.compile(
    r"Sanction Intake:\s*(\d+)\s+CAP Seats:\s*(\d+)\s+\[\s*"
    r"MS Seats:\s*(\d+)\s+Minority Seats\s*:\s*(\d+)\s+AI Seats:\s*(\d+)\s*\]\s*"
    r"Institute Seats\s*(\d+)"
)


def parse_file(pdf_path: str):
    txt = subprocess.run(
        ["pdftotext", "-layout", pdf_path, "-"],
        capture_output=True, text=True,
    ).stdout
    inst_code = os.path.splitext(os.path.basename(pdf_path))[0]
    choice = branch = ""
    awaiting = False  # true right after a choice line, until its first intake
    rows = []
    for line in txt.splitlines():
        cm = CHOICE_RE.match(line)
        if cm:
            choice, branch = cm.group(1), cm.group(2)
            awaiting = True
            continue
        im = INST_RE.match(line.strip())
        if im and not line.strip().startswith(choice[:5] if choice else "\0"):
            # institute header (5-digit + name); trust the filename code instead
            pass
        if awaiting:
            m = INTAKE_RE.search(line)
            if m:
                rows.append({
                    "institute_code": inst_code,
                    "choice_code": choice,
                    "branch": branch,
                    "sanction_intake": int(m.group(1)),
                    "cap_seats": int(m.group(2)),
                    "ms_seats": int(m.group(3)),
                    "minority_seats": int(m.group(4)),
                    "ai_seats": int(m.group(5)),
                    "institute_seats": int(m.group(6)),
                })
                awaiting = False  # only the first (regular) intake per branch
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    pdfs = sorted(glob.glob(os.path.join(args.dir, "*.pdf")))
    total = 0
    with open(args.out, "w") as f:
        for p in pdfs:
            try:
                for r in parse_file(p):
                    f.write(json.dumps(r) + "\n")
                    total += 1
            except Exception as e:  # keep going; the gate catches gaps
                print(f"warn: {p}: {e}", file=sys.stderr)
    print(f"parsed {total} branch-intake rows from {len(pdfs)} institutes", file=sys.stderr)


if __name__ == "__main__":
    main()
