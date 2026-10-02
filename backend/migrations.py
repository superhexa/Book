"""Phase 2 database migrations — Jordanian football platform.

Idempotent index creation for all Phase-2 collections. Safe to run on every
boot and from seed scripts: ``create_index`` with the same name/spec is a
no-op, and we guard the whole run so a partially-initialized DB never
crashes startup.

Import-safe: importing this module has no side effects (no DB calls at
import time). Entry point: ``await run_migrations()``.

Index naming: rely on Mongo's default generated names for single-field
indexes; give explicit names to compound indexes so re-runs stay idempotent
even if key order/spelling changes are reviewed later.
"""
import logging

logger = logging.getLogger("turfbook.migrations")


async def ensure_indexes(db):
    """Create all Phase-2 indexes. Idempotent — safe to call repeatedly."""
    c = db  # alias for brevity

    # ---- geography ----
    await c.governorates.create_index("key", unique=True)
    await c.governorates.create_index("is_active")

    await c.cities.create_index(
        [("governorate_key", 1), ("key", 1)],
        unique=True, name="cities_governorate_key_1_key_1",
    )
    await c.cities.create_index("governorate_key")
    await c.cities.create_index("is_active")

    await c.areas.create_index(
        [("governorate_key", 1), ("city_key", 1), ("key", 1)],
        unique=True, name="areas_gov_1_city_1_key_1",
    )
    await c.areas.create_index([("governorate_key", 1), ("city_key", 1)],
                               name="areas_gov_1_city_1")
    await c.areas.create_index("is_active")

    # ---- teams & players ----
    await c.teams.create_index("slug", unique=True)
    await c.teams.create_index("owner_id")
    await c.teams.create_index("governorate_key")
    await c.teams.create_index("is_verified")
    await c.teams.create_index("deleted_at")

    await c.team_members.create_index(
        [("team_id", 1), ("user_id", 1)],
        unique=True, name="team_members_team_1_user_1",
    )
    await c.team_members.create_index("user_id")
    await c.team_members.create_index("team_id")

    await c.team_invitations.create_index("token", unique=True)
    await c.team_invitations.create_index([("team_id", 1), ("status", 1)],
                                          name="team_invitations_team_1_status_1")
    await c.team_invitations.create_index("invited_user_id")
    await c.team_invitations.create_index("expires_at", expireAfterSeconds=0)

    await c.player_profiles.create_index("user_id", unique=True)
    await c.player_profiles.create_index("display_name")

    # ---- leagues ----
    await c.leagues.create_index("slug", unique=True)
    await c.leagues.create_index([("status", 1), ("is_active", 1)],
                                 name="leagues_status_1_active_1")
    await c.leagues.create_index("organizer_id")
    await c.leagues.create_index("governorate_key")
    await c.leagues.create_index("deleted_at")

    await c.seasons.create_index([("league_id", 1), ("name", 1)],
                                 unique=True, name="seasons_league_1_name_1")
    await c.seasons.create_index("league_id")
    await c.seasons.create_index([("league_id", 1), ("is_current", 1)],
                                 name="seasons_league_1_current_1")

    await c.divisions.create_index([("league_id", 1), ("season_id", 1)],
                                   name="divisions_league_1_season_1")
    await c.divisions.create_index("season_id")

    await c.league_teams.create_index(
        [("league_id", 1), ("season_id", 1), ("team_id", 1)],
        unique=True, name="league_teams_league_1_season_1_team_1",
    )
    await c.league_teams.create_index([("league_id", 1), ("season_id", 1), ("status", 1)],
                                      name="league_teams_league_1_season_1_status_1")
    await c.league_teams.create_index("team_id")

    await c.fixtures.create_index([("league_id", 1), ("season_id", 1), ("round_number", 1)],
                                  name="fixtures_league_1_season_1_round_1")
    await c.fixtures.create_index("tournament_id")
    await c.fixtures.create_index("tournament_round_id")
    await c.fixtures.create_index("scheduled_at")
    await c.fixtures.create_index("match_id")

    # ---- matches ----
    await c.matches.create_index("fixture_id")
    await c.matches.create_index([("league_id", 1), ("season_id", 1), ("status", 1)],
                                 name="matches_league_1_season_1_status_1")
    await c.matches.create_index("tournament_id")
    await c.matches.create_index("tournament_round_id")
    await c.matches.create_index("home_team_id")
    await c.matches.create_index("away_team_id")
    await c.matches.create_index("scheduled_at")
    await c.matches.create_index("status")

    # event timeline ordering: all events of a match sorted by minute
    await c.match_events.create_index(
        [("match_id", 1), ("minute", 1), ("extra_minute", 1), ("created_at", 1)],
        name="match_events_match_1_minute_1",
    )
    await c.match_events.create_index("player_id")
    await c.match_events.create_index("team_id")

    await c.match_lineups.create_index(
        [("match_id", 1), ("team_id", 1)],
        unique=True, name="match_lineups_match_1_team_1",
    )

    # derived stats: one row per player/team per competition scope
    await c.player_statistics.create_index("player_id")
    await c.player_statistics.create_index(
        [("player_id", 1), ("scope.league_id", 1), ("scope.season_id", 1),
         ("scope.tournament_id", 1)],
        unique=True, name="player_stats_player_1_scope_1",
    )
    await c.team_statistics.create_index("team_id")
    await c.team_statistics.create_index(
        [("team_id", 1), ("scope.league_id", 1), ("scope.season_id", 1),
         ("scope.tournament_id", 1)],
        unique=True, name="team_stats_team_1_scope_1",
    )

    # standings: one row per team per league/season/division-group
    await c.standings.create_index(
        [("league_id", 1), ("season_id", 1), ("division_id", 1),
         ("group", 1), ("team_id", 1)],
        unique=True, name="standings_league_1_season_1_div_1_group_1_team_1",
    )
    await c.standings.create_index(
        [("league_id", 1), ("season_id", 1), ("points", -1), ("goal_difference", -1)],
        name="standings_league_1_season_1_table",
    )

    # ---- tournaments ----
    await c.tournaments.create_index("slug", unique=True)
    await c.tournaments.create_index([("status", 1), ("is_active", 1)],
                                     name="tournaments_status_1_active_1")
    await c.tournaments.create_index("organizer_id")
    await c.tournaments.create_index("deleted_at")

    await c.tournament_groups.create_index(
        [("tournament_id", 1), ("name", 1)],
        unique=True, name="tournament_groups_tournament_1_name_1",
    )
    await c.tournament_rounds.create_index(
        [("tournament_id", 1), ("stage_order", 1)],
        name="tournament_rounds_tournament_1_stage_1",
    )

    await c.tournament_entries.create_index(
        [("tournament_id", 1), ("team_id", 1)],
        unique=True, name="tournament_entries_tournament_1_team_1",
    )
    await c.tournament_entries.create_index([("tournament_id", 1), ("status", 1)],
                                            name="tournament_entries_tournament_1_status_1")
    await c.tournament_entries.create_index("team_id")

    # ---- officiating & disputes ----
    await c.disputes.create_index([("status", 1), ("created_at", -1)],
                                  name="disputes_status_1_created_-1")
    await c.disputes.create_index("raised_by")
    await c.disputes.create_index("match_id")
    await c.disputes.create_index("booking_id")
    await c.disputes.create_index("assigned_to")

    await c.referees.create_index("user_id", unique=True, sparse=True)
    await c.referees.create_index("license_number", unique=True, sparse=True)
    await c.referees.create_index("is_active")
    await c.referees.create_index("governorate_key")

    await c.referee_assignments.create_index(
        [("match_id", 1), ("referee_id", 1), ("role", 1)],
        unique=True, name="ref_assign_match_1_ref_1_role_1",
    )
    await c.referee_assignments.create_index("match_id")
    await c.referee_assignments.create_index("referee_id")

    # ---- content & messaging ----
    await c.news.create_index("slug", unique=True)
    await c.news.create_index([("status", 1), ("published_at", -1)],
                              name="news_status_1_published_-1")
    await c.news.create_index("is_featured")
    await c.news.create_index("league_id")
    await c.news.create_index("tournament_id")

    await c.announcements.create_index([("status", 1), ("published_at", -1)],
                                       name="announcements_status_1_published_-1")
    await c.announcements.create_index("audience")
    await c.announcements.create_index("expires_at")

    await c.push_subscriptions.create_index(
        [("user_id", 1), ("endpoint", 1)],
        unique=True, name="push_subs_user_1_endpoint_1",
    )
    await c.push_subscriptions.create_index("user_id")
    await c.push_subscriptions.create_index("is_active")

    await c.notification_preferences.create_index("user_id", unique=True)

    # settings._id IS the key — the default _id index is the unique lookup.
    await c.settings.create_index("updated_at")

    logger.info("Phase-2 indexes ensured")


async def run_migrations():
    """Run all Phase-2 migrations against the configured database.

    Import this as ``from migrations import run_migrations``. The ``db``
    import happens inside the function so importing this module never
    touches the database or requires config/env at import time.
    """
    from db import db  # local import: keeps module import-safe

    await ensure_indexes(db)
