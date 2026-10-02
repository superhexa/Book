"""Competition engine: fixture generation (round-robin / knockout) and standings.

Pure helpers (`generate_round_robin`, `generate_knockout`, `calculate_standings`)
are side-effect free. `recalculate_standings` reads FINISHED matches from Mongo
and upserts `standings` documents; it is idempotent (re-running produces the
same table, and stale rows for teams with no finished matches are removed).
"""
from math import ceil, log2
from typing import List, Optional

from db import db, new_id, now

# Match status counted towards the standings table.
FINISHED = "FINISHED"

DEFAULT_TIE_BREAKERS = ["points", "gd", "gf", "head_to_head"]


def generate_round_robin(team_ids: List[str], double: bool = False) -> List[List[tuple]]:
    """Circle-method round-robin. Returns [round -> [(home_id, away_id), ...]].

    With an odd number of teams a bye slot is inserted (skipped in the output).
    `double=True` appends a second leg with reversed home/away.
    """
    teams = list(dict.fromkeys(t for t in team_ids if t))
    n = len(teams)
    if n < 2:
        return []
    arr = list(teams)
    if n % 2 == 1:
        arr.append(None)  # bye
    m = len(arr)
    rounds: List[List[tuple]] = []
    for r in range(m - 1):
        pairs = []
        for i in range(m // 2):
            a, b = arr[i], arr[m - 1 - i]
            if a is None or b is None:
                continue
            pairs.append((a, b) if r % 2 == 0 else (b, a))
        rounds.append(pairs)
        # rotate all but the first
        arr = [arr[0]] + [arr[-1]] + arr[1:-1]
    if double:
        rounds += [[(b, a) for (a, b) in rnd] for rnd in rounds]
    return rounds


def generate_knockout(team_ids: List[str]) -> List[dict]:
    """Single-elimination bracket. Returns [round -> {"round": n, "round_name": str,
    "matches": [{"home_team_id", "away_team_id", "bye"}]}].

    Top seeds receive byes when the field is not a power of two. Later rounds
    are emitted as TBD placeholders (home/away None).
    """
    teams = list(dict.fromkeys(t for t in team_ids if t))
    n = len(teams)
    if n < 2:
        return []
    rounds_count = ceil(log2(n))
    size = 2 ** rounds_count
    byes = size - n
    # seeds 1..byes advance directly
    remaining = teams[byes:]
    first: List[dict] = []
    for i in range(len(remaining) // 2):
        first.append({
            "home_team_id": remaining[i],
            "away_team_id": remaining[-(i + 1)],
            "bye": False,
        })
    rounds = [{
        "round": 1,
        "round_name": _round_name(rounds_count, 1),
        "matches": first,
    }]
    advancing = byes + len(first)
    for r in range(2, rounds_count + 1):
        advancing //= 2
        rounds.append({
            "round": r,
            "round_name": _round_name(rounds_count, r),
            "matches": [
                {"home_team_id": None, "away_team_id": None, "bye": False}
                for _ in range(advancing // 2)
            ],
        })
    return rounds


def _round_name(total_rounds: int, round_no: int) -> str:
    left = total_rounds - round_no
    if left == 0:
        return "النهائي"
    if left == 1:
        return "نصف النهائي"
    if left == 2:
        return "ربع النهائي"
    return f"الدور {round_no}"


def calculate_standings(matches: List[dict], tie_breakers: Optional[List[str]] = None) -> List[dict]:
    """Build a league table from match dicts.

    Each row: team_id, played, won, drawn, lost, gf, ga, gd, points.
    Only matches with status FINISHED (and home/away scores set) count.
    `tie_breakers`: ordered keys among points, gd, gf, head_to_head.
    head_to_head is a best-effort mini-league for exact 2-way ties; for larger
    tied groups it is a documented placeholder (no reordering).
    """
    tb = tie_breakers or DEFAULT_TIE_BREAKERS
    table: dict = {}

    def row(tid):
        return table.setdefault(tid, {
            "team_id": tid, "played": 0, "won": 0, "drawn": 0, "lost": 0,
            "gf": 0, "ga": 0, "gd": 0, "points": 0,
        })

    counted = []
    for m in matches or []:
        if m.get("status") != FINISHED:
            continue
        h, a = m.get("home_team_id"), m.get("away_team_id")
        hs, aws = m.get("home_score"), m.get("away_score")
        if not h or not a or hs is None or aws is None:
            continue
        counted.append(m)
        rh, ra = row(h), row(a)
        rh["played"] += 1
        ra["played"] += 1
        rh["gf"] += hs
        rh["ga"] += aws
        ra["gf"] += aws
        ra["ga"] += hs
        if hs > aws:
            rh["won"] += 1
            ra["lost"] += 1
            rh["points"] += 3
        elif hs < aws:
            ra["won"] += 1
            rh["lost"] += 1
            ra["points"] += 3
        else:
            rh["drawn"] += 1
            ra["drawn"] += 1
            rh["points"] += 1
            ra["points"] += 1
    for r in table.values():
        r["gd"] = r["gf"] - r["ga"]

    rows = list(table.values())
    # primary sort by the configured numeric keys (descending)
    numeric = [k for k in tb if k in ("points", "gd", "gf")]
    rows.sort(key=lambda r: tuple(-r[k] for k in numeric) or (0,))

    # best-effort 2-way head-to-head resolution for exact ties
    if "head_to_head" in tb:
        rows = _apply_head_to_head(rows, counted, numeric)
    return rows


def _apply_head_to_head(rows: List[dict], matches: List[dict], numeric: List[str]) -> List[dict]:
    out = []
    i = 0
    while i < len(rows):
        j = i + 1
        while j < len(rows) and all(rows[j][k] == rows[i][k] for k in numeric):
            j += 1
        group = rows[i:j]
        if len(group) == 2:
            a, b = group[0]["team_id"], group[1]["team_id"]
            pa, pb = 0, 0
            for m in matches:
                h, ah = m.get("home_team_id"), m.get("away_team_id")
                if {h, ah} != {a, b}:
                    continue
                hs, aws = m.get("home_score", 0), m.get("away_score", 0)
                ha = hs if h == a else aws
                hb = aws if h == a else hs
                if ha > hb:
                    pa += 3
                elif hb > ha:
                    pb += 3
                else:
                    pa += 1
                    pb += 1
            if pa != pb:
                group = sorted(group, key=lambda r: -(pa if r["team_id"] == a else pb))
        out.extend(group)
        i = j
    return out


async def recalculate_standings(league_id: str, season_id: str) -> List[dict]:
    """Rebuild the standings table for (league_id, season_id) from FINISHED
    matches. Upserts one `standings` doc per team and removes stale rows, so
    the operation is idempotent."""
    cursor = db.matches.find({
        "league_id": league_id, "season_id": season_id,
        "status": FINISHED, "deleted_at": None,
    })
    matches = await cursor.to_list(10000)
    rows = calculate_standings(matches)
    keep = [r["team_id"] for r in rows]
    # remove rows for teams that no longer have finished matches
    await db.standings.delete_many({
        "league_id": league_id, "season_id": season_id,
        "team_id": {"$nin": keep},
    })
    t = now()
    for r in rows:
        await db.standings.update_one(
            {"league_id": league_id, "season_id": season_id, "team_id": r["team_id"]},
            {"$set": {**r, "league_id": league_id, "season_id": season_id,
                      "updated_at": t},
             "$setOnInsert": {"_id": new_id(), "created_at": t}},
            upsert=True,
        )
    return rows
