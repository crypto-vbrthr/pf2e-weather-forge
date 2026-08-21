import { MODULE_ID, TIME_SEGMENTS } from "./weather-engine.js";
import { getCalendarState } from "./calendar-engine.js";

export const CALENDAR_SOURCE_MODES = ["auto", "calendarForge", "internal"];
export const DAYPART_AUTOMATION_MODES = ["manual", "automatic"];
export const DEFAULT_DAYPART_BOUNDARIES = Object.freeze({ morning: 5, noon: 11, afternoon: 14, evening: 18, night: 22 });

const MOON_ID_MAP = Object.freeze({
  new: "newMoon",
  "new-moon": "newMoon",
  "waxing-crescent": "waxingCrescent",
  "first-quarter": "firstQuarter",
  "waxing-gibbous": "waxingGibbous",
  full: "fullMoon",
  "full-moon": "fullMoon",
  "waning-gibbous": "waningGibbous",
  "last-quarter": "lastQuarter",
  "third-quarter": "lastQuarter",
  "waning-crescent": "waningCrescent"
});

function number(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function setting(key, fallback = null) {
  try { return game.settings.get(MODULE_ID, key) ?? fallback; }
  catch (_) { return fallback; }
}

export function normalizeDaypartBoundaries(value = {}) {
  const source = { ...DEFAULT_DAYPART_BOUNDARIES, ...(value ?? {}) };
  const values = TIME_SEGMENTS.map(key => Math.max(0, Math.min(23, Math.trunc(number(source[key], DEFAULT_DAYPART_BOUNDARIES[key])))));
  const valid = values.every((hour, index) => index === 0 || hour > values[index - 1]);
  if (!valid) return { ...DEFAULT_DAYPART_BOUNDARIES };
  return Object.fromEntries(TIME_SEGMENTS.map((key, index) => [key, values[index]]));
}

export function getDaypartForHour(hour, boundaries = DEFAULT_DAYPART_BOUNDARIES) {
  const b = normalizeDaypartBoundaries(boundaries);
  const h = number(hour, 0);
  if (h >= b.night || h < b.morning) return "night";
  if (h >= b.evening) return "evening";
  if (h >= b.afternoon) return "afternoon";
  if (h >= b.noon) return "noon";
  return "morning";
}

export function getCalendarForgeApi() {
  const module = game.modules?.get?.("pf2e-calendar-forge");
  if (!module?.active) return null;
  const api = module.api ?? globalThis.CalendarForge?.api ?? null;
  return api?.getTemporalContext && api?.toWorldTime ? api : null;
}

export function isCalendarForgeAvailable() {
  return Boolean(getCalendarForgeApi());
}

export function configuredCalendarSourceMode() {
  const mode = String(setting("calendarSourceMode", "auto"));
  return CALENDAR_SOURCE_MODES.includes(mode) ? mode : "auto";
}

export function effectiveCalendarSourceMode() {
  const configured = configuredCalendarSourceMode();
  if (configured === "internal") return "internal";
  if (isCalendarForgeAvailable()) return "calendarForge";
  return "internal";
}

function validProviderSelection(id, entries) {
  if (!id) return "";
  if (!Array.isArray(entries) || !entries.length) return id;
  return entries.some(entry => entry?.id === id) ? id : "";
}

export function calendarForgeOptions(extra = {}) {
  const requestedRegion = String(setting("calendarForgeRegionId", "") ?? "").trim();
  const requestedMoon = String(setting("calendarForgeMoonId", "") ?? "").trim();

  let regionId = requestedRegion;
  let moonId = requestedMoon;
  try {
    const api = getCalendarForgeApi();
    if (api) {
      regionId = validProviderSelection(requestedRegion, api.regions?.list?.() ?? []);
      moonId = validProviderSelection(requestedMoon, api.moonProfiles?.list?.() ?? []);
    }
  } catch (_) {}

  return {
    ...(regionId ? { regionId } : {}),
    ...(moonId ? { moonProfileIds: [moonId] } : {}),
    ...extra
  };
}

export function calendarForgeRuntimeStatus() {
  const configured = configuredCalendarSourceMode();
  const available = isCalendarForgeAvailable();
  const effective = effectiveCalendarSourceMode();
  return {
    configured,
    available,
    effective,
    fallback: configured !== "internal" && effective === "internal"
  };
}

export function mapSeasonId(id, fallback = "spring") {
  const value = String(id ?? "").toLowerCase();
  if (["spring", "summer", "autumn", "winter"].includes(value)) return value;
  if (value === "fall") return "autumn";
  return ["spring", "summer", "autumn", "winter"].includes(fallback) ? fallback : "spring";
}

export function mapMoonPhase(moon, fallback = "newMoon") {
  if (!moon) return fallback;
  const id = String(moon.phase ?? "").trim();
  if (MOON_ID_MAP[id]) return MOON_ID_MAP[id];
  if (["newMoon", "waxingCrescent", "firstQuarter", "waxingGibbous", "fullMoon", "waningGibbous", "lastQuarter", "waningCrescent"].includes(id)) return id;
  const p = ((number(moon.progress, 0) % 1) + 1) % 1;
  const index = Math.floor((p + 0.0625) * 8) % 8;
  return ["newMoon", "waxingCrescent", "firstQuarter", "waxingGibbous", "fullMoon", "waningGibbous", "lastQuarter", "waningCrescent"][index];
}

function selectWeatherMoon(context) {
  const requested = String(setting("calendarForgeMoonId", "") ?? "").trim();
  return context?.moons?.find?.(moon => moon.id === requested) ?? context?.moons?.[0] ?? null;
}

export function contextToCalendarSnapshot(context, { boundaries = null, fallbackWeather = null } = {}) {
  const b = normalizeDaypartBoundaries(boundaries ?? setting("daypartBoundaries", DEFAULT_DAYPART_BOUNDARIES));
  const moon = selectWeatherMoon(context);
  const names = context?.calendar?.names ?? {};
  const previousSeason = fallbackWeather?.season ?? "spring";
  const previousMoon = fallbackWeather?.moonPhase ?? "newMoon";
  return {
    source: "calendarForge",
    worldTime: number(context?.worldTime, number(game.time?.worldTime, 0)),
    timeSegment: getDaypartForHour(context?.time?.hour, b),
    hour: number(context?.time?.hour, 0),
    minute: number(context?.time?.minute, 0),
    second: number(context?.time?.second, 0),
    weekday: context?.calendar?.weekdayId ?? fallbackWeather?.weekday ?? "moonday",
    weekdayLabel: names.weekday ?? context?.calendar?.weekdayId ?? "",
    dayOfMonth: number(context?.calendar?.day, fallbackWeather?.dayOfMonth ?? 1),
    month: context?.calendar?.monthId ?? fallbackWeather?.month ?? "abadius",
    monthLabel: names.month ?? context?.calendar?.monthId ?? "",
    year: number(context?.calendar?.year, fallbackWeather?.year ?? 4726),
    moonPhase: mapMoonPhase(moon, previousMoon),
    moonPhaseLabel: moon?.phaseLabel ?? moon?.phase ?? "",
    moonId: moon?.id ?? null,
    season: mapSeasonId(context?.season?.id, previousSeason),
    seasonLabel: context?.season?.label ?? context?.season?.id ?? "",
    calendarId: context?.calendar?.id ?? null,
    calendarLabel: context?.calendar?.label ?? "",
    regionId: context?.regionId ?? null,
    regionLabel: context?.region?.label ?? "",
    formattedDate: context?.formatted?.date ?? "",
    formattedTime: context?.formatted?.time ?? "",
    calendarLabels: {
      weekday: names.weekday ?? "",
      month: names.month ?? "",
      moonPhase: moon?.phaseLabel ?? "",
      season: context?.season?.label ?? ""
    }
  };
}

export async function getCalendarForgeSnapshot({ worldTime = null, fallbackWeather = null } = {}) {
  const api = getCalendarForgeApi();
  if (!api) return null;
  const options = calendarForgeOptions(worldTime == null ? {} : { worldTime: number(worldTime, 0) });
  const context = await api.getTemporalContext(options);
  const hoursPerDay = number(context?.raw?.calendar?.time?.hoursPerDay, 24);
  const boundaries = normalizeDaypartBoundaries(setting("daypartBoundaries", DEFAULT_DAYPART_BOUNDARIES));
  if (hoursPerDay <= boundaries.night) throw new Error(`Calendar Forge calendar '${context.calendar?.id}' has only ${hoursPerDay} hours per day; Weather Forge daypart boundaries require at least ${boundaries.night + 1}.`);
  return contextToCalendarSnapshot(context, { boundaries, fallbackWeather });
}

export async function getEffectiveCalendarSnapshot({ worldTime = null, fallbackWeather = null } = {}) {
  if (effectiveCalendarSourceMode() === "calendarForge") {
    try {
      const snapshot = await getCalendarForgeSnapshot({ worldTime, fallbackWeather });
      if (snapshot) return snapshot;
    } catch (error) {
      console.warn(`${MODULE_ID} | Calendar Forge context unavailable; using internal calendar fallback`, error);
    }
  }
  const internal = await getCalendarState();
  return { ...internal, source: "internal", worldTime: null, calendarLabels: {} };
}

function secondsPerDayFromContext(context) {
  const time = context?.raw?.calendar?.time ?? {};
  return number(time.secondsPerMinute, 60) * number(time.minutesPerHour, 60) * number(time.hoursPerDay, 24);
}

function phaseKey(segment, startWorldTime) {
  return `${Math.round(number(startWorldTime, 0))}:${segment}`;
}

async function calendarForgeContextAt(worldTime) {
  const api = getCalendarForgeApi();
  if (!api) throw new Error("Calendar Forge is not available");
  return api.getTemporalContext(calendarForgeOptions({ worldTime: number(worldTime, 0) }));
}

async function worldTimeForLocal(context, hour) {
  const api = getCalendarForgeApi();
  return api.toWorldTime({
    year: context.calendar.year,
    monthId: context.calendar.monthId,
    day: context.calendar.day,
    hour,
    minute: 0,
    second: 0
  }, calendarForgeOptions());
}

export async function getCalendarForgePhaseInfo(worldTime = game.time?.worldTime) {
  const api = getCalendarForgeApi();
  if (!api) return null;
  const wt = number(worldTime, 0);
  const context = await calendarForgeContextAt(wt);
  const boundaries = normalizeDaypartBoundaries(setting("daypartBoundaries", DEFAULT_DAYPART_BOUNDARIES));
  const hoursPerDay = number(context?.raw?.calendar?.time?.hoursPerDay, 24);
  if (hoursPerDay <= boundaries.night) throw new Error("The selected Calendar Forge calendar is not compatible with the configured Weather Forge daypart hours.");
  const segment = getDaypartForHour(context.time.hour, boundaries);
  const dayStart = await worldTimeForLocal(context, 0);
  const secondsPerDay = secondsPerDayFromContext(context);

  let startWorldTime;
  let nextBoundaryWorldTime;
  let nextSegment;
  if (segment === "night") {
    if (context.time.hour < boundaries.morning) {
      const previousContext = await calendarForgeContextAt(dayStart - 1);
      startWorldTime = await worldTimeForLocal(previousContext, boundaries.night);
      nextBoundaryWorldTime = await worldTimeForLocal(context, boundaries.morning);
    } else {
      startWorldTime = await worldTimeForLocal(context, boundaries.night);
      const nextDayContext = await calendarForgeContextAt(dayStart + secondsPerDay + 1);
      nextBoundaryWorldTime = await worldTimeForLocal(nextDayContext, boundaries.morning);
    }
    nextSegment = "morning";
  } else {
    const index = TIME_SEGMENTS.indexOf(segment);
    nextSegment = TIME_SEGMENTS[index + 1] ?? "night";
    startWorldTime = await worldTimeForLocal(context, boundaries[segment]);
    nextBoundaryWorldTime = await worldTimeForLocal(context, boundaries[nextSegment]);
  }

  const snapshot = contextToCalendarSnapshot(context, { boundaries });
  return {
    key: phaseKey(segment, startWorldTime),
    segment,
    startWorldTime,
    nextBoundaryWorldTime,
    nextSegment,
    context,
    calendar: snapshot
  };
}

export async function enumerateCalendarForgePhaseBoundaries(fromWorldTime, toWorldTime, { max = 5000 } = {}) {
  let from = number(fromWorldTime, 0);
  const to = number(toWorldTime, 0);
  if (!(to > from)) return [];
  const result = [];
  let phase = await getCalendarForgePhaseInfo(from);
  let guard = 0;
  while (phase && phase.nextBoundaryWorldTime <= to && guard < max) {
    const entered = await getCalendarForgePhaseInfo(phase.nextBoundaryWorldTime);
    result.push(entered);
    from = phase.nextBoundaryWorldTime + 1;
    phase = await getCalendarForgePhaseInfo(from);
    guard += 1;
  }
  if (guard >= max && phase?.nextBoundaryWorldTime <= to) {
    const error = new RangeError(`Calendar Forge catch-up exceeds the safe limit of ${max} daypart boundaries.`);
    error.code = "WEATHER_FORGE_CATCHUP_LIMIT";
    error.boundaryLimit = max;
    throw error;
  }
  return result;
}

export function listCalendarForgeRegions() {
  const api = getCalendarForgeApi();
  if (!api) return [];
  return api.regions?.list?.() ?? [];
}

export function listCalendarForgeMoons() {
  const api = getCalendarForgeApi();
  if (!api) return [];
  return api.moonProfiles?.list?.() ?? [];
}
