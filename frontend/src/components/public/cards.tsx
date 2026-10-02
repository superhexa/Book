// Shared public cards — FieldCard, MatchCard, TeamCard, LeagueCard, PlayerCard.
// All Arabic, RTL-safe, responsive (cards are 100% width; parents lay out grids).
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { MapPin, SealCheck, Trophy } from "phosphor-react-native";
import { Pressable, Text, View } from "react-native";

import { fileUrl, jod, arDateTime, arTime, isLiveStatus, isFinishedStatus, leagueStatusAr, matchStatusAr, positionAr } from "@/src/sport-api";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Stars } from "@/src/ui";
import type { Facility, League, Match, Player, Team } from "@/src/sport-api";

const FALLBACK_FIELD = "https://images.unsplash.com/photo-1567792264121-682b7b4d9376?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80";
const FALLBACK_LOGO = "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?crop=entropy&cs=srgb&fm=jpg&w=400&q=70";

// --------------------------------- FieldCard ---------------------------------

export function FieldCard({ facility, testID }: { facility: Facility; testID?: string }) {
  const s = useStyles();
  const img = fileUrl(facility.cover_image) || FALLBACK_FIELD;
  return (
    <Pressable
      testID={testID}
      onPress={() => router.push(`/fields/${facility.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [s.card, pressed && { opacity: 0.94, transform: [{ scale: 0.995 }] }]}
    >
      <Image source={{ uri: img }} style={s.image} contentFit="cover" transition={200} />
      <LinearGradient colors={["transparent", "rgba(10,8,12,0.82)"]} style={s.scrim} />
      {facility.status === "VERIFIED" ? (
        <View style={s.badge}>
          <SealCheck size={14} weight="fill" color="#FFFFFF" />
          <Text style={s.badgeTxt}>موثّق</Text>
        </View>
      ) : null}
      <View style={s.ratingPill}>
        <Stars rating={facility.rating_avg || 0} size={12} />
      </View>
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{facility.name}</Text>
        <View style={s.locRow}>
          <MapPin size={13} color="#FFFFFFCC" />
          <Text style={s.loc} numberOfLines={1}>
            {[facility.area, facility.city].filter(Boolean).join("، ") || "الأردن"}
          </Text>
        </View>
        <View style={s.bottomRow}>
          {facility.min_price ? (
            <Text style={s.price}>
              {jod(facility.min_price)} <Text style={s.priceUnit}>/ ساعة</Text>
            </Text>
          ) : (
            <View />
          )}
          {facility.pitch_count ? <Text style={s.pitches}>{facility.pitch_count} ملاعب</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

// --------------------------------- MatchCard ---------------------------------

export function MatchCard({ match, testID }: { match: Match; testID?: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  const live = isLiveStatus(match.status);
  const finished = isFinishedStatus(match.status);
  const showScore = live || finished;
  return (
    <Pressable
      testID={testID}
      onPress={() => router.push(`/matches/${match.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [s.matchCard, pressed && { opacity: 0.94 }]}
    >
      <View style={s.matchTop}>
        <View style={s.leagueChip}>
          <Trophy size={12} color={colors.brandPrimary} weight="fill" />
          <Text style={s.leagueChipTxt} numberOfLines={1}>{match.league || "مباراة"}</Text>
        </View>
        <View style={[s.statusPill, live && s.statusLive, finished && s.statusDone]}>
          {live ? <View style={s.liveDot} /> : null}
          <Text style={[s.statusTxt, live && { color: "#FFFFFF" }]}>{matchStatusAr(match.status)}</Text>
        </View>
      </View>

      <View style={s.matchBody}>
        <TeamSide name={match.home?.name} logo={match.home?.logo} align="start" />
        <View style={s.scoreBox}>
          {showScore ? (
            <Text style={s.score}>
              {match.home_score ?? 0} - {match.away_score ?? 0}
            </Text>
          ) : (
            <Text style={s.kickoff}>{arTime(match.kickoff)}</Text>
          )}
          <Text style={s.matchMeta} numberOfLines={1}>
            {showScore ? arDateTime(match.kickoff) : arDateTime(match.kickoff)}
          </Text>
        </View>
        <TeamSide name={match.away?.name} logo={match.away?.logo} align="end" />
      </View>

      {match.venue ? (
        <View style={s.venueRow}>
          <MapPin size={12} color={colors.muted} />
          <Text style={s.venueTxt} numberOfLines={1}>{match.venue}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function TeamSide({ name, logo, align }: { name?: string; logo?: string; align: "start" | "end" }) {
  const s = useStyles();
  return (
    <View style={[s.teamSide, align === "end" && { alignItems: "flex-end" }]}>
      <Image source={{ uri: logo || FALLBACK_LOGO }} style={s.teamLogo} contentFit="cover" />
      <Text style={[s.teamName, align === "end" && { textAlign: "right" }]} numberOfLines={2}>
        {name || "—"}
      </Text>
    </View>
  );
}

// --------------------------------- TeamCard ----------------------------------

export function TeamCard({ team, testID }: { team: Team; testID?: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => router.push(`/teams/${team.slug || team.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [s.plainCard, pressed && { opacity: 0.94 }]}
    >
      <Image source={{ uri: team.logo || FALLBACK_LOGO }} style={s.circleLogo} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text style={s.plainTitle} numberOfLines={1}>{team.name}</Text>
        <Text style={s.plainSub} numberOfLines={1}>{team.city || "الأردن"}</Text>
        {team.played != null ? (
          <Text style={s.record}>
            {team.played} مباراة · {team.won ?? 0} فوز · {team.drawn ?? 0} تعادل · {team.lost ?? 0} خسارة
          </Text>
        ) : null}
      </View>
      {team.points != null ? (
        <View style={s.pointsBox}>
          <Text style={s.pointsNum}>{team.points}</Text>
          <Text style={s.pointsLbl}>نقطة</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// -------------------------------- LeagueCard ---------------------------------

export function LeagueCard({ league, testID }: { league: League; testID?: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => router.push(`/leagues/${league.slug || league.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [s.plainCard, s.leagueCard, pressed && { opacity: 0.94 }]}
    >
      <View style={s.leagueLogoWrap}>
        {league.logo ? (
          <Image source={{ uri: league.logo }} style={s.leagueLogo} contentFit="contain" />
        ) : (
          <Trophy size={30} color={colors.brandPrimary} weight="duotone" />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.plainTitle} numberOfLines={1}>{league.name}</Text>
        <Text style={s.plainSub} numberOfLines={1}>
          {[league.season, league.teams_count ? `${league.teams_count} فرق` : null].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {league.status ? (
        <View style={s.statusPill}>
          <Text style={s.statusTxt}>{leagueStatusAr(league.status)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// -------------------------------- PlayerCard ---------------------------------

export function PlayerCard({ player, testID }: { player: Player; testID?: string }) {
  const s = useStyles();
  return (
    <Pressable
      testID={testID}
      onPress={() => router.push(`/players/${player.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [s.plainCard, pressed && { opacity: 0.94 }]}
    >
      <Image source={{ uri: player.photo || FALLBACK_LOGO }} style={s.circleLogo} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text style={s.plainTitle} numberOfLines={1}>{player.name}</Text>
        <Text style={s.plainSub} numberOfLines={1}>
          {[positionAr(player.position), player.team_name].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <View style={s.statCol}>
        <Text style={s.statNum}>{player.goals ?? 0}</Text>
        <Text style={s.statLbl}>أهداف</Text>
      </View>
      <View style={s.statCol}>
        <Text style={s.statNum}>{player.assists ?? 0}</Text>
        <Text style={s.statLbl}>تمريرات</Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  // FieldCard
  card: { height: 230, borderRadius: radius.lg, overflow: "hidden", backgroundColor: c.surfaceSecondary },
  image: { width: "100%", height: "100%" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 150 },
  badge: {
    position: "absolute", top: spacing.md, right: spacing.md,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: c.brandPrimary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
  },
  badgeTxt: { color: "#FFFFFF", fontSize: fontSize.sm, fontWeight: "700" },
  ratingPill: {
    position: "absolute", top: spacing.md, left: spacing.md,
    backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill,
  },
  info: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: 3 },
  name: { color: "#FFFFFF", fontSize: fontSize.xl, fontWeight: "700" },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  loc: { color: "#FFFFFFCC", fontSize: fontSize.base },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  price: { color: "#FFFFFF", fontSize: fontSize.lg, fontWeight: "700" },
  priceUnit: { color: "#FFFFFFAA", fontSize: fontSize.sm, fontWeight: "400" },
  pitches: { color: "#FFFFFFCC", fontSize: fontSize.sm },

  // MatchCard
  matchCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg },
  matchTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  leagueChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.brandTertiary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, maxWidth: "60%" },
  leagueChipTxt: { color: c.onBrandTertiary, fontSize: fontSize.sm, fontWeight: "600" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.surfaceTertiary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  statusLive: { backgroundColor: c.error },
  statusDone: { backgroundColor: c.surfaceTertiary },
  statusTxt: { color: c.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: "700" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
  matchBody: { flexDirection: "row", alignItems: "center" },
  teamSide: { flex: 1, alignItems: "flex-start", gap: 8 },
  teamLogo: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.surfaceTertiary },
  teamName: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "700", textAlign: "left" },
  scoreBox: { alignItems: "center", paddingHorizontal: spacing.sm, minWidth: 110 },
  score: { color: c.onSurface, fontSize: fontSize["3xl"], fontWeight: "800", letterSpacing: 1 },
  kickoff: { color: c.brandPrimary, fontSize: fontSize.xl, fontWeight: "800" },
  matchMeta: { color: c.muted, fontSize: fontSize.sm, marginTop: 4 },
  venueRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: spacing.md },
  venueTxt: { color: c.muted, fontSize: fontSize.sm },

  // plain cards (team / league / player)
  plainCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg,
  },
  leagueCard: { borderTopWidth: 3, borderTopColor: c.brandPrimary },
  plainTitle: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  plainSub: { color: c.muted, fontSize: fontSize.base, marginTop: 2 },
  circleLogo: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.surfaceTertiary },
  leagueLogoWrap: {
    width: 64, height: 64, borderRadius: radius.md, backgroundColor: c.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  leagueLogo: { width: 48, height: 48 },
  record: { color: c.muted, fontSize: fontSize.sm, marginTop: 4 },
  pointsBox: { alignItems: "center", backgroundColor: c.brandTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pointsNum: { color: c.onBrandTertiary, fontSize: fontSize.xl, fontWeight: "800" },
  pointsLbl: { color: c.onBrandTertiary, fontSize: fontSize.sm },
  statCol: { alignItems: "center", minWidth: 52 },
  statNum: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "800" },
  statLbl: { color: c.muted, fontSize: fontSize.sm },
}));
