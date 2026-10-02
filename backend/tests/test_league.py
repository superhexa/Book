"""اختبارات الدوري — League engine contract tests.

The leagues/tournaments module is being built in a parallel workstream, so
these tests pin the *contract* from the platform spec:

- collections: ``leagues``, ``seasons``, ``teams``, ``players``, ``matches``,
  ``standings``
- endpoints (prefix): ``/api/leagues``, ``/api/seasons``, ``/api/teams``,
  ``/api/matches``
- ``generate_round_robin`` and ``compute_standings`` below are the reference
  implementation of that contract: circle-method fixtures (every pair meets
  exactly once) and a standard 3-1-0 table sorted by points, goal difference,
  goals scored. The real engine must satisfy the same assertions.
"""
import itertools

import pytest


# ------------------- reference implementation (spec contract) ---------------
def generate_round_robin(team_ids, double_round=False):
    """Circle method. Returns rounds: list of rounds, each a list of
    ``(home_id, away_id)``. With ``double_round`` every pair meets twice,
    home/away swapped in the second leg."""
    teams = list(dict.fromkeys(team_ids))  # de-dup, keep order
    if len(teams) < 2:
        raise ValueError("need at least 2 teams")
    if len(teams) % 2 == 1:
        teams.append(None)  # bye
    n = len(teams)
    order = teams[:]
    unordered_rounds = []
    for _ in range(n - 1):
        pairs = []
        for i in range(n // 2):
            a, b = order[i], order[n - 1 - i]
            if a is None or b is None:
                continue
            pairs.append((a, b))
        unordered_rounds.append(pairs)
        order = [order[0]] + [order[-1]] + order[1:-1]
    # assign home/away greedily so no team is stuck mostly home or away
    home_count = {t: 0 for t in teams if t is not None}
    rounds = []
    for r, pairs in enumerate(unordered_rounds):
        rnd = []
        for a, b in pairs:
            if home_count[a] < home_count[b]:
                h, aw = a, b
            elif home_count[b] < home_count[a]:
                h, aw = b, a
            else:
                h, aw = (a, b) if r % 2 == 0 else (b, a)
            home_count[h] += 1
            rnd.append((h, aw))
        rounds.append(rnd)
    if double_round:
        rounds += [[(a, h) for h, a in rnd] for rnd in rounds]
    return rounds


def compute_standings(team_ids, matches):
    """3 pts win / 1 draw. Sorted by points, goal difference, goals for,
    then team id. ``matches``: list of dicts with home_id/away_id/home_goals/
    away_goals (``None`` goals = not played). Pure + idempotent."""
    table = {t: {"team_id": t, "played": 0, "won": 0, "drawn": 0, "lost": 0,
                 "gf": 0, "ga": 0, "gd": 0, "points": 0} for t in team_ids}
    for m in matches:
        if m.get("home_goals") is None or m.get("away_goals") is None:
            continue
        h, a = table[m["home_id"]], table[m["away_id"]]
        hg, ag = m["home_goals"], m["away_goals"]
        for side, gf, ga in ((h, hg, ag), (a, ag, hg)):
            side["played"] += 1
            side["gf"] += gf
            side["ga"] += ga
        if hg > ag:
            h["won"] += 1
            a["lost"] += 1
            h["points"] += 3
        elif ag > hg:
            a["won"] += 1
            h["lost"] += 1
            a["points"] += 3
        else:
            h["drawn"] += 1
            a["drawn"] += 1
            h["points"] += 1
            a["points"] += 1
    for row in table.values():
        row["gd"] = row["gf"] - row["ga"]
    return sorted(table.values(),
                  key=lambda r: (-r["points"], -r["gd"], -r["gf"], r["team_id"]))


def _pairs(rounds):
    return [(h, a) for rnd in rounds for h, a in rnd]


# --------------------------------- tests -----------------------------------
class TestRoundRobin:
    def test_four_teams_each_pair_meets_once(self):
        teams = ["t1", "t2", "t3", "t4"]
        rounds = generate_round_robin(teams)
        assert len(rounds) == 3  # n-1 rounds
        pairs = _pairs(rounds)
        assert len(pairs) == 6
        unordered = {tuple(sorted(p)) for p in pairs}
        assert unordered == {tuple(sorted(p)) for p in itertools.combinations(teams, 2)}

    def test_each_round_uses_every_team_once(self):
        teams = ["a", "b", "c", "d", "e", "f"]
        for rnd in generate_round_robin(teams):
            flat = [t for p in rnd for t in p]
            assert sorted(flat) == sorted(teams)

    def test_odd_team_count_gets_byes(self):
        teams = ["a", "b", "c", "d", "e"]
        rounds = generate_round_robin(teams)
        pairs = _pairs(rounds)
        assert len(pairs) == 10  # C(5,2)
        # each round one team sits out
        for rnd in rounds:
            flat = [t for p in rnd for t in p]
            assert len(flat) == 4 and len(set(flat)) == 4
        # every team plays 4 matches
        from collections import Counter
        counts = Counter(t for p in pairs for t in p)
        assert all(v == 4 for v in counts.values())

    def test_two_teams_single_match(self):
        assert _pairs(generate_round_robin(["x", "y"])) == [("x", "y")]

    def test_home_away_balance(self):
        teams = [f"t{i}" for i in range(6)]
        pairs = _pairs(generate_round_robin(teams))
        home = {t: sum(1 for h, _ in pairs if h == t) for t in teams}
        away = {t: sum(1 for _, a in pairs if a == t) for t in teams}
        for t in teams:
            assert home[t] >= 1 and away[t] >= 1
            assert abs(home[t] - away[t]) <= 1

    def test_double_round_meets_twice_swapped(self):
        teams = ["a", "b", "c", "d"]
        pairs = _pairs(generate_round_robin(teams, double_round=True))
        assert len(pairs) == 12
        from collections import Counter
        counts = Counter(tuple(sorted(p)) for p in pairs)
        assert all(v == 2 for v in counts.values())
        # second leg reverses the fixture
        first, second = pairs[:6], pairs[6:]
        assert {(a, h) for h, a in first} == set(second)

    def test_needs_two_teams(self):
        with pytest.raises(ValueError):
            generate_round_robin(["solo"])


class TestStandings:
    def _matches(self):
        # t1 beats t2 2-0, draws t3 1-1; t2 beats t3 3-1
        return [
            {"home_id": "t1", "away_id": "t2", "home_goals": 2, "away_goals": 0},
            {"home_id": "t1", "away_id": "t3", "home_goals": 1, "away_goals": 1},
            {"home_id": "t2", "away_id": "t3", "home_goals": 3, "away_goals": 1},
        ]

    def test_points_and_order(self):
        table = compute_standings(["t1", "t2", "t3"], self._matches())
        assert [r["team_id"] for r in table] == ["t1", "t2", "t3"]
        by_id = {r["team_id"]: r for r in table}
        assert by_id["t1"]["points"] == 4
        assert by_id["t2"]["points"] == 3
        assert by_id["t3"]["points"] == 1
        assert by_id["t1"]["gd"] == 2
        assert by_id["t2"]["gf"] == 3

    def test_tiebreak_goal_difference_then_goals(self):
        matches = [
            {"home_id": "a", "away_id": "c", "home_goals": 3, "away_goals": 0},
            {"home_id": "b", "away_id": "c", "home_goals": 2, "away_goals": 0},
        ]
        table = compute_standings(["a", "b", "c"], matches)
        assert [r["team_id"] for r in table] == ["a", "b", "c"]  # gd 3 > 2

    def test_unplayed_matches_ignored(self):
        matches = self._matches() + [
            {"home_id": "t1", "away_id": "t2", "home_goals": None, "away_goals": None},
        ]
        table = compute_standings(["t1", "t2", "t3"], matches)
        assert {r["team_id"]: r["played"] for r in table} == {"t1": 2, "t2": 2, "t3": 2}

    def test_recalculation_is_idempotent(self):
        """Recomputing from the same results must yield the identical table —
        standings are replaced, never accumulated."""
        matches = self._matches()
        first = compute_standings(["t1", "t2", "t3"], matches)
        second = compute_standings(["t1", "t2", "t3"], matches)
        assert first == second
        # and a later result only changes the table through the results list
        extended = matches + [
            {"home_id": "t3", "away_id": "t1", "home_goals": 2, "away_goals": 0}]
        third = compute_standings(["t1", "t2", "t3"], extended)
        assert third != first
        assert [r["team_id"] for r in third][0] == "t3"
        # replaying the full list again is still stable
        assert compute_standings(["t1", "t2", "t3"], extended) == third
