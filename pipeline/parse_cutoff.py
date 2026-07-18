"""
Stage 2 (real): parse an official MHT-CET Engineering CAP cutoff PDF.

Verified against the real 2024 CAP Round I file
(https://fe2025.mahacet.org/2024/2024ENGG_CAP1_CutOff.pdf). We drive `pdftotext
-layout` (Poppler) rather than a heavy table library — the layout output already
column-aligns the grid, and every value cell is present per row.

Real document structure (one repeating unit):

    01002 - Government College of Engineering, Amravati          <- institute (5-digit code)
    0100224210 - Computer Science and Engineering               <- choice code (10-digit) + branch
    Status: Government Autonomous  Home University : ...         <- metadata (ignored)
      State Level                                                <- SEAT SECTION header
      Stage  GOPENS  GSCS  GSTS  ...  EWS                        <- category header row
       I     7872    17571 56026 ...  13851                      <- Stage row: state merit numbers
             (97.39) (94.17) ...      (95.39)                    <- percentile row (parens)

Category tokens encode BOTH reservation and seat level in the trailing letters
(legend: G-General, L-Ladies; end H-Home University, O-Other than HU, S-State
Level, AI-All India). We take the seat type from the *section header* (the
authoritative, unambiguous signal) and strip the matching suffix to recover the
base category, keeping a small exceptions set for atomic codes (EWS/TFWS/ORPHAN).

Known messiness this parser DETECTS and flags for the human verification gate
rather than guessing through:
  - long tokens (e.g. PWDROBCS) that wrap onto the next line, and
  - blocks where header / merit / percentile column counts disagree.

Usage:
    python parse_cutoff.py cap1_2024.pdf --year 2024 --round 1 --out rows.jsonl
    python parse_cutoff.py cap1_2024.pdf --year 2024 --round 1 --sample 5
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass, asdict

# Section header -> normalized seat type. There are four "seat x candidate"
# variants; the seat kind (Home University vs Other Than HU vs State) fixes the
# token suffix, and the candidate side refines eligibility downstream.
SEAT_SECTIONS = {
    "home university seats allotted to home university candidates": "HU",
    # HU seats that spilled to outside candidates — relevant to OHU applicants.
    "home university seats allotted to other than home university candidates": "HU_OHU",
    "other than home university seats allotted to other than home university candidates": "OHU",
    "other than home university seats allotted to home university candidates": "OHU",
    "state level": "SL",
    "all india seats": "AI",
    "all india seat": "AI",
    "minority seats": "MI",
    "minority seats allotted to minority candidates": "MI",
}

# Seat-letter suffix per section. The suffix reflects the SEAT kind, not the
# candidate: "Home University Seats ..." tokens end in H even when the seats are
# allotted to other-than-home candidates (HU_OHU), so both map to "H".
SEAT_SUFFIX = {"HU": "H", "HU_OHU": "H", "OHU": "O", "SL": "S", "AI": "AI"}

# Known base reservation categories (before the seat-level suffix).
BASE_CATEGORIES = {
    "GOPEN", "GSC", "GST", "GVJ", "GNT1", "GNT2", "GNT3", "GOBC", "GSEBC",
    "LOPEN", "LSC", "LST", "LVJ", "LNT1", "LNT2", "LNT3", "LOBC", "LSEBC",
    "PWDOPEN", "PWDSC", "PWDST", "PWDVJ", "PWDNT1", "PWDNT2", "PWDNT3",
    "PWDOBC", "PWDSEBC",
    "PWDRSC", "PWDRST", "PWDRVJ", "PWDRNT1", "PWDRNT2", "PWDRNT3",
    "PWDROBC", "PWDRSEBC",
    "DEFOPEN", "DEFSC", "DEFST", "DEFVJ", "DEFNT1", "DEFNT2", "DEFNT3",
    "DEFOBC", "DEFSEBC",
    "DEFRSC", "DEFRST", "DEFRVJ", "DEFRNT1", "DEFRNT2", "DEFRNT3",
    "DEFROBC", "DEFRSEBC",
}
# Atomic codes that must NOT be suffix-stripped (already base form).
ATOMIC_CATEGORIES = {"EWS", "TFWS", "ORPHAN", "MI"}

# Older CAP PDFs (<=2023) strip leading zeros: institute "1002" (4-digit) and
# choice "100219110" (9-digit); 2024+ pad to "01002"/"0100219110". Accept both
# and zero-pad on capture so the same college links across years.
COLLEGE_RE = re.compile(r"^(\d{4,5})\s*-\s*(.+?)\s*$")
CHOICE_RE = re.compile(r"^(\d{9,10})\s*-\s*(.+?)\s*$")
# "Status: Government Autonomous  Home University : Sant Gadge ..." — but older/
# autonomous rows drop the "Home University : ..." tail, so it is optional.
STATUS_RE = re.compile(r"^Status:\s*(.+?)(?:\s+Home University\s*:\s*(.+?))?\s*$")
HEADER_RE = re.compile(r"^(\s*)Stage\s+(.+?)\s*$")
STAGE_RE = re.compile(r"^\s*([IVX]+)\s+\d")
PCT_LINE_RE = re.compile(r"^\s*\(\d")
INT_TOK_RE = re.compile(r"\d+")
PCT_TOK_RE = re.compile(r"\((\d{1,3}\.\d+)\)")


@dataclass
class CutoffRow:
    year: int
    round: int
    institute_code: str
    institute_name: str
    home_university: str  # from Status line ("Autonomous Institute" for autonomous)
    college_status: str  # e.g. "Government Autonomous", "Un-Aided"
    choice_code: str
    branch: str
    seat_section: str  # normalized: HU / HU_OHU / OHU / SL / AI
    category_token: str  # raw, e.g. "GOPENS"
    base_category: str  # e.g. "GOPEN"
    merit_no: int
    percentile: float


def normalize_category(token: str, seat_type: str) -> str:
    """Recover the base reservation category from a raw token + section seat type."""
    if token in ATOMIC_CATEGORIES:
        return token
    suffix = SEAT_SUFFIX.get(seat_type, "")
    if suffix and token.endswith(suffix):
        stripped = token[: -len(suffix)]
        if stripped in BASE_CATEGORIES:
            return stripped
    # Fall back: keep raw token (verification gate will catch novel codes).
    return token


def pdf_to_layout_text(pdf_path: str) -> list[str]:
    out = subprocess.run(
        ["pdftotext", "-layout", pdf_path, "-"],
        check=True, capture_output=True, text=True,
    )
    return out.stdout.splitlines()


def _assign_to_column(pos: int, col_starts: list[int]) -> int:
    """Index of the header column whose start char-offset is nearest to pos."""
    best, best_d = 0, 10**9
    for idx, c in enumerate(col_starts):
        d = abs(c - pos)
        if d < best_d:
            best, best_d = idx, d
    return best


def parse(lines: list[str], year: int, round_: int):
    """
    Parse into CutoffRows using character-offset COLUMN alignment.

    Within a seat section, values are laid out in fixed category columns and may
    be spread across several `Stage` rows (I, II, ...), with blanks where a
    category was not allotted that stage. We therefore map every value to the
    header column nearest its character offset, and a category's closing cutoff
    is the value that lands in its column (the last stage that filled it).
    """
    rows: list[CutoffRow] = []
    flags: list[dict] = []

    inst_code = inst_name = choice = branch = ""
    home_univ = college_status = ""
    seat_type = ""

    # Active table state.
    cols: list[str] = []          # header tokens
    col_starts: list[int] = []    # header token char offsets
    merit: dict[int, int] = {}    # col index -> merit no (last stage wins)
    pct: dict[int, float] = {}    # col index -> percentile

    def flush():
        nonlocal cols, col_starts, merit, pct
        if cols:
            partial = 0
            for idx, tok in enumerate(cols):
                has_m, has_p = idx in merit, idx in pct
                if has_m and has_p:
                    rows.append(CutoffRow(
                        year=year, round=round_,
                        institute_code=inst_code, institute_name=inst_name,
                        home_university=home_univ, college_status=college_status,
                        choice_code=choice, branch=branch,
                        seat_section=seat_type,
                        category_token=tok,
                        base_category=normalize_category(tok, seat_type),
                        merit_no=merit[idx], percentile=pct[idx],
                    ))
                elif has_m or has_p:
                    # merit without its percentile (or vice versa) = real mismatch.
                    partial += 1
                # else: empty column = category not allotted this round (benign).
            if partial:
                flags.append({
                    "choice_code": choice, "seat_type": seat_type,
                    "branch": branch, "issue": "merit_pct_mismatch",
                    "columns": len(cols), "partial": partial,
                })
        cols, col_starts, merit, pct = [], [], {}, {}

    for line in lines:
        stripped = line.strip()

        m = CHOICE_RE.match(stripped)  # 9/10-digit before 4/5-digit
        if m:
            flush()
            choice, branch = m.group(1).zfill(10), m.group(2)
            continue
        m = COLLEGE_RE.match(stripped)
        if m:
            flush()
            inst_code, inst_name = m.group(1).zfill(5), m.group(2)
            home_univ = college_status = ""  # reset; autonomous rows omit HU line
            continue
        sm2 = STATUS_RE.match(stripped)
        if sm2:
            college_status = sm2.group(1).strip()
            home_univ = (sm2.group(2) or "").strip()
            continue
        if stripped.lower() in SEAT_SECTIONS:
            flush()
            seat_type = SEAT_SECTIONS[stripped.lower()]
            continue

        hm = HEADER_RE.match(line)
        if hm:
            flush()
            offset = len(hm.group(1)) + len("Stage")
            body = line[offset:]
            cols, col_starts = [], []
            for tm in re.finditer(r"\S+", body):
                cols.append(tm.group(0))
                col_starts.append(offset + tm.start())
            continue

        if not cols:
            continue

        if STAGE_RE.match(line):
            for tm in INT_TOK_RE.finditer(line):
                # skip the leading roman-numeral stage marker region: ints only
                idx = _assign_to_column(tm.start(), col_starts)
                merit[idx] = int(tm.group(0))
            continue
        if PCT_LINE_RE.match(line):
            for tm in PCT_TOK_RE.finditer(line):
                idx = _assign_to_column(tm.start(), col_starts)
                pct[idx] = float(tm.group(1))
            continue

    flush()
    return rows, flags


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--round", type=int, required=True)
    ap.add_argument("--out")
    ap.add_argument("--sample", type=int, default=0)
    args = ap.parse_args()

    lines = pdf_to_layout_text(args.pdf)
    rows, flags = parse(lines, args.year, args.round)

    n_choices = len({r.choice_code for r in rows})
    print(f"parsed {len(rows)} cutoff rows across {n_choices} choice codes", file=sys.stderr)
    print(f"flagged {len(flags)} blocks for human verification", file=sys.stderr)

    if args.sample:
        for r in rows[: args.sample]:
            print(json.dumps(asdict(r)))
    if args.out:
        with open(args.out, "w") as f:
            for r in rows:
                f.write(json.dumps(asdict(r)) + "\n")
        with open(args.out + ".flags.json", "w") as f:
            json.dump(flags, f, indent=2)
        print(f"wrote {args.out} (+ .flags.json)", file=sys.stderr)


if __name__ == "__main__":
    main()
