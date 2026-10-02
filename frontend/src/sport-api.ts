// Public sports API layer for the Jordan football platform website.
//
// Wraps the backend REST API (`/api/...`) for all public pages. Endpoints that
// don't exist on the backend yet (leagues, teams, matches, players, ...) fail
// gracefully to empty pages so the UI shows beautiful Arabic empty states
// instead of errors — pages light up automatically once the backend lands.
//
// Pagination shape assumed: { items, total, page, limit }.

import { useQuery } from "@tanstack/react-query";

import { api, fileUrl } from "@/src/api";

export { fileUrl };

export type Page<T> = { items: T[]; total: number; page: number; limit: number };

const emptyPage = <T,>(): Page<T> => ({ items: [], total: 0, page: 1, limit: 20 });

async function getPage<T>(path: string): Promise<Page<T>> {
  try {
    const data = await api.get<any>(path, false);
    if (data && Array.isArray(data.items)) {
      return {
        items: data.items as T[],
        total: typeof data.total === "number" ? data.total : data.items.length,
        page: data.page ?? 1,
        limit: data.limit ?? 20,
      };
    }
    if (Array.isArray(data)) {
      return { items: data as T[], total: data.length, page: 1, limit: data.length || 20 };
    }
  } catch {
    /* endpoint may not exist yet — degrade to an empty page */
  }
  return emptyPage<T>();
}

async function getOne<T>(path: string): Promise<T | null> {
  try {
    return await api.get<T>(path, false);
  } catch {
    return null;
  }
}

// ---------------------------------- types ----------------------------------

export type Facility = {
  id: string;
  name: string;
  city?: string;
  area?: string;
  address?: string;
  cover_image?: string;
  images?: string[];
  description?: string;
  rating_avg?: number;
  rating_count?: number;
  status?: string;
  min_price?: number;
  currency?: string;
  pitch_count?: number;
  amenities?: string[];
  phone?: string;
  latitude?: number;
  longitude?: number;
  pitches?: Pitch[];
  owner?: { id: string; name?: string };
};

export type Pitch = {
  id: string;
  name?: string;
  size?: string;
  grass_type?: string;
  field_type?: string;
  indoor?: boolean;
  pricing?: { base_hourly?: number; currency?: string };
  images?: string[];
};

export type Review = {
  id: string;
  rating: number;
  comment?: string;
  customer_name?: string;
  created_at?: string;
  owner_response?: string;
};

export type League = {
  id: string;
  slug?: string;
  name: string;
  logo?: string;
  season?: string;
  status?: string;
  teams_count?: number;
  description?: string;
};

export type StandingRow = {
  team_id: string;
  team_name: string;
  team_logo?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export type Team = {
  id: string;
  slug?: string;
  name: string;
  logo?: string;
  city?: string;
  founded?: number;
  coach?: string;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  goals_for?: number;
  goals_against?: number;
  points?: number;
  players?: Player[];
};

export type Player = {
  id: string;
  name: string;
  photo?: string;
  position?: string;
  team_id?: string;
  team_name?: string;
  team_logo?: string;
  goals?: number;
  assists?: number;
  appearances?: number;
  yellow_cards?: number;
  red_cards?: number;
  nationality?: string;
  age?: number;
};

export type MatchSide = { id?: string; name: string; logo?: string };

export type MatchEvent = {
  id?: string;
  minute?: number;
  type: string;
  team?: string;
  player?: string;
  detail?: string;
};

export type Match = {
  id: string;
  home: MatchSide;
  away: MatchSide;
  home_score?: number;
  away_score?: number;
  status?: string;
  kickoff?: string;
  venue?: string;
  venue_id?: string;
  league?: string;
  league_id?: string;
  league_logo?: string;
  round?: string;
  referee?: string;
  events?: MatchEvent[];
};

export type Scorer = {
  player_id: string;
  player_name: string;
  photo?: string;
  team_name?: string;
  team_logo?: string;
  goals: number;
  assists?: number;
};

export type PlatformStats = {
  fields?: number;
  players?: number;
  matches?: number;
  leagues?: number;
  bookings?: number;
  cities?: number;
};

export type Governorate = { id: string; ar: string; en: string };

// ------------------------------ governorates -------------------------------
// The 12 Jordanian governorates. Prefer the backend list when it exists:
// GET /api/geo/governorates (not implemented yet — falls back to this list).
export const GOVERNORATES: Governorate[] = [
  { id: "amman", ar: "عمّان", en: "Amman" },
  { id: "zarqa", ar: "الزرقاء", en: "Zarqa" },
  { id: "irbid", ar: "إربد", en: "Irbid" },
  { id: "aqaba", ar: "العقبة", en: "Aqaba" },
  { id: "balqa", ar: "البلقاء", en: "Balqa" },
  { id: "karak", ar: "الكرك", en: "Karak" },
  { id: "madaba", ar: "مادبا", en: "Madaba" },
  { id: "jarash", ar: "جرش", en: "Jerash" },
  { id: "mafraq", ar: "المفرق", en: "Mafraq" },
  { id: "maan", ar: "معان", en: "Ma'an" },
  { id: "tafilah", ar: "الطفيلة", en: "Tafilah" },
  { id: "ajloun", ar: "عجلون", en: "Ajloun" },
];

// --------------------------------- helpers ---------------------------------

const STALE = 60_000;

export function jod(amount?: number | null): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  const n = Math.round((amount + Number.EPSILON) * 100) / 100;
  const num = n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
  return `د.أ ${num}`;
}

function safeDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function arDate(iso?: string): string {
  const d = safeDate(iso);
  return d ? d.toLocaleDateString("ar-JO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
}

export function arDateShort(iso?: string): string {
  const d = safeDate(iso);
  return d ? d.toLocaleDateString("ar-JO", { weekday: "short", day: "numeric", month: "short" }) : "";
}

export function arTime(iso?: string): string {
  const d = safeDate(iso);
  return d ? d.toLocaleTimeString("ar-JO", { hour: "numeric", minute: "2-digit" }) : "";
}

export function arDateTime(iso?: string): string {
  const d = safeDate(iso);
  return d ? `${arDateShort(iso)} · ${arTime(iso)}` : "";
}

export function matchStatusAr(status?: string): string {
  const s = (status || "").toUpperCase();
  if (s === "LIVE" || s === "IN_PROGRESS" || s === "FIRST_HALF" || s === "SECOND_HALF" || s === "HALF_TIME") return "مباشر";
  if (s === "SCHEDULED" || s === "UPCOMING" || s === "NOT_STARTED") return "قادمة";
  if (s === "FINISHED" || s === "COMPLETED" || s === "FT" || s === "FULL_TIME") return "انتهت";
  if (s === "POSTPONED") return "مؤجلة";
  if (s === "CANCELLED") return "ملغاة";
  return "قادمة";
}

export function isLiveStatus(status?: string): boolean {
  return matchStatusAr(status) === "مباشر";
}
export function isFinishedStatus(status?: string): boolean {
  const s = matchStatusAr(status);
  return s === "انتهت" || s === "ملغاة";
}

const POSITION_AR: Record<string, string> = {
  GK: "حارس مرمى",
  GOALKEEPER: "حارس مرمى",
  DF: "مدافع",
  DEFENDER: "مدافع",
  MF: "لاعب وسط",
  MIDFIELDER: "لاعب وسط",
  FW: "مهاجم",
  FORWARD: "مهاجم",
  STRIKER: "مهاجم",
  WINGER: "جناح",
};
export function positionAr(pos?: string): string {
  if (!pos) return "—";
  return POSITION_AR[pos.toUpperCase()] ?? pos;
}

export function leagueStatusAr(status?: string): string {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE" || s === "ONGOING" || s === "IN_PROGRESS") return "نشط";
  if (s === "UPCOMING" || s === "SCHEDULED") return "قريباً";
  if (s === "FINISHED" || s === "COMPLETED") return "منتهٍ";
  return status || "";
}

// ---------------------------------- hooks ----------------------------------

export type FacilityFilters = {
  q?: string;
  city?: string;
  field_type?: string;
  min_rating?: number;
  sort?: string;
  page?: number;
  limit?: number;
};

export function useFacilities(f: FacilityFilters) {
  const qs = new URLSearchParams();
  if (f.q) qs.set("q", f.q);
  if (f.city) qs.set("city", f.city);
  if (f.field_type) qs.set("field_type", f.field_type);
  if (f.min_rating) qs.set("min_rating", String(f.min_rating));
  qs.set("sort", f.sort || "rating");
  qs.set("page", String(f.page || 1));
  qs.set("limit", String(f.limit || 12));
  const key = qs.toString();
  return useQuery({
    queryKey: ["public-facilities", key],
    queryFn: () => getPage<Facility>(`/facilities?${key}`),
    staleTime: STALE,
  });
}

export function useFacility(id?: string) {
  return useQuery({
    queryKey: ["public-facility", id],
    queryFn: () => getOne<Facility>(`/facilities/${id}`),
    enabled: !!id,
    staleTime: STALE,
  });
}

export function useFacilityReviews(id?: string) {
  return useQuery({
    queryKey: ["public-facility-reviews", id],
    queryFn: () => getPage<Review>(`/facilities/${id}/reviews`),
    enabled: !!id,
    staleTime: STALE,
  });
}

export function useLeagues(page = 1, limit = 12, status?: string) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) qs.set("status", status);
  const key = qs.toString();
  return useQuery({
    queryKey: ["public-leagues", key],
    queryFn: () => getPage<League>(`/leagues?${key}`),
    staleTime: STALE,
  });
}

export function useLeague(slug?: string) {
  return useQuery({
    queryKey: ["public-league", slug],
    queryFn: () => getOne<League>(`/leagues/${slug}`),
    enabled: !!slug,
    staleTime: STALE,
  });
}

export function useStandings(leagueId?: string) {
  return useQuery({
    queryKey: ["public-standings", leagueId],
    queryFn: () => getPage<StandingRow>(`/leagues/${leagueId}/standings`),
    enabled: !!leagueId,
    staleTime: STALE,
  });
}

export function useLeagueFixtures(leagueId?: string) {
  return useQuery({
    queryKey: ["public-league-fixtures", leagueId],
    queryFn: () => getPage<Match>(`/leagues/${leagueId}/fixtures`),
    enabled: !!leagueId,
    staleTime: STALE,
  });
}

export function useTeams(params: { q?: string; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams({
    page: String(params.page || 1),
    limit: String(params.limit || 12),
  });
  if (params.q) qs.set("q", params.q);
  const key = qs.toString();
  return useQuery({
    queryKey: ["public-teams", key],
    queryFn: () => getPage<Team>(`/teams?${key}`),
    staleTime: STALE,
  });
}

export function useTeam(slug?: string) {
  return useQuery({
    queryKey: ["public-team", slug],
    queryFn: () => getOne<Team>(`/teams/${slug}`),
    enabled: !!slug,
    staleTime: STALE,
  });
}

export function usePlayers(params: { q?: string; position?: string; team_id?: string; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams({
    page: String(params.page || 1),
    limit: String(params.limit || 12),
  });
  if (params.q) qs.set("q", params.q);
  if (params.position) qs.set("position", params.position);
  if (params.team_id) qs.set("team_id", params.team_id);
  const key = qs.toString();
  return useQuery({
    queryKey: ["public-players", key],
    queryFn: () => getPage<Player>(`/players?${key}`),
    staleTime: STALE,
  });
}

export function usePlayer(id?: string) {
  return useQuery({
    queryKey: ["public-player", id],
    queryFn: () => getOne<Player>(`/players/${id}`),
    enabled: !!id,
    staleTime: STALE,
  });
}

export function useMatches(params: { status?: string; league_id?: string; team_id?: string; date?: string; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams({
    page: String(params.page || 1),
    limit: String(params.limit || 20),
  });
  if (params.status) qs.set("status", params.status);
  if (params.league_id) qs.set("league_id", params.league_id);
  if (params.team_id) qs.set("team_id", params.team_id);
  if (params.date) qs.set("date", params.date);
  const key = qs.toString();
  return useQuery({
    queryKey: ["public-matches", key],
    queryFn: () => getPage<Match>(`/matches?${key}`),
    staleTime: 30_000,
  });
}

export function useMatch(id?: string) {
  return useQuery({
    queryKey: ["public-match", id],
    queryFn: () => getOne<Match>(`/matches/${id}`),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useTopScorers(limit = 10) {
  return useQuery({
    queryKey: ["public-top-scorers", limit],
    queryFn: () => getPage<Scorer>(`/leaderboards/scorers?limit=${limit}`),
    staleTime: STALE,
  });
}

export function useTopAssists(limit = 10) {
  return useQuery({
    queryKey: ["public-top-assists", limit],
    queryFn: () => getPage<Scorer>(`/leaderboards/assists?limit=${limit}`),
    staleTime: STALE,
  });
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ["public-platform-stats"],
    queryFn: () => getOne<PlatformStats>(`/stats`),
    staleTime: 5 * 60_000,
  });
}

export function useGovernorates(): Governorate[] {
  const q = useQuery({
    queryKey: ["public-governorates"],
    queryFn: () => getPage<Governorate>(`/geo/governorates`),
    staleTime: 60 * 60_000,
  });
  return q.data && q.data.items.length ? q.data.items : GOVERNORATES;
}
