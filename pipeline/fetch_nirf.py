"""
Fetch NIRF Engineering rankings (official, nirfindia.org) for a range of years
and rank-bands, filter to Maharashtra, emit JSONL.

Each ranking page has a table:
    <table id="tbl_overall"> Institute ID | Name | City | State | Score | Rank
Top-100 is EngineeringRanking.html; further bands are EngineeringRanking{150,
200,300}.html (101-150, 151-200, 201-300). The Institute ID (e.g. IR-E-U-0306)
is stable across years, giving clean multi-year linkage.

Usage: python fetch_nirf.py --years 2021-2025 --out nirf.jsonl
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.request

UA = "CETwiki-research/0.1 (+contact: admin@cetwiki.example)"


def http_get(url: str, timeout: int = 45) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""

# page suffix -> rank band label
PAGES = {"": None, "150": "101-150", "200": "151-200", "300": "201-300"}


def clean(cell: str) -> str:
    # take text before the first nested block, strip remaining tags
    cell = re.split(r"<div|<a\s", cell)[0]
    cell = re.sub(r"<[^>]+>", "", cell)
    return html.unescape(cell).replace("\xa0", " ").strip()


# Each institute row: <td>ID</td><td>Name<div…detail table…</div></td>
# <td>City</td><td>State</td><td>Score</td><td>Rank</td></tr>.
# The nested "More Details" table breaks flat parsing, so we anchor the four
# clean trailing cells to the `</div></td>` that ends the name cell.
ROW_RE = re.compile(
    r"<td>(IR-E-[UI]-\d+)</td>"       # institute id
    r"<td>([^<]+?)<.*?</div></td>"    # name + (detail div)
    r"<td>([^<]*)</td>"               # city
    r"<td>([^<]*)</td>"               # state
    r"<td>([^<]*)</td>"               # score
    r"<td>([^<]*)</td></tr>",         # rank
    re.S,
)


# Band pages (101-150, …) are simple: <tr><td>Name</td><td>City</td><td>State</td>
SIMPLE_RE = re.compile(
    r"<tr><td>([^<]+)</td><td>([^<]+)</td><td>([^<]+)</td></tr>"
)


def parse(htmltext: str, year: int, band: str | None):
    out = []
    if band is None:
        # ranked top-100 page: id + score + rank, with nested detail tables
        for m in ROW_RE.finditer(htmltext):
            inst_id, name, city, state, score, rank = (clean(x) for x in m.groups())
            if state.lower() != "maharashtra":
                continue
            rank_int = int(rank) if re.fullmatch(r"\d+", rank) else None
            out.append({
                "year": year, "nirf_institute_id": inst_id, "name": name,
                "city": city, "state": state,
                "score": float(score) if re.fullmatch(r"\d+(\.\d+)?", score) else None,
                "rank": rank_int, "band": None,
            })
    else:
        # rank-band page: name / city / state only (no per-institute rank/score)
        for m in SIMPLE_RE.finditer(htmltext):
            name, city, state = (clean(x) for x in m.groups())
            if state.lower() != "maharashtra":
                continue
            out.append({
                "year": year, "nirf_institute_id": None, "name": name,
                "city": city, "state": state, "score": None, "rank": None,
                "band": band,
            })
    return out


def fetch_year(year: int):
    rows = []
    for suffix, band in PAGES.items():
        url = f"https://www.nirfindia.org/Rankings/{year}/EngineeringRanking{suffix}.html"
        try:
            status, body = http_get(url)
            if status != 200 or "tbl_overall" not in body:
                print(f"  skip {url} ({status})", file=sys.stderr)
                continue
            got = parse(body, year, band)
            print(f"  {url} -> {len(got)} MH rows", file=sys.stderr)
            rows.extend(got)
        except Exception as e:
            print(f"  error {url}: {e}", file=sys.stderr)
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", default="2021-2025")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    a, b = (int(x) for x in args.years.split("-"))

    all_rows = []
    for y in range(a, b + 1):
        print(f"year {y}", file=sys.stderr)
        all_rows.extend(fetch_year(y))
    with open(args.out, "w") as f:
        for r in all_rows:
            f.write(json.dumps(r) + "\n")
    insts = len({r["nirf_institute_id"] for r in all_rows})
    print(f"wrote {len(all_rows)} rows, {insts} distinct MH institutes", file=sys.stderr)


if __name__ == "__main__":
    main()
