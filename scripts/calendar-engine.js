import { MODULE_ID, TIME_SEGMENTS, WEEKDAYS, MONTHS, MONTH_LENGTHS, defaultWeatherState } from "./weather-engine.js";

export const MOON_PHASES = ["newMoon", "waxingCrescent", "firstQuarter", "waxingGibbous", "fullMoon", "waningGibbous", "lastQuarter", "waningCrescent"];

export function defaultCalendarState() {
  const base = defaultWeatherState();
  return {
    timeSegment: base.timeSegment,
    weekday: base.weekday,
    dayOfMonth: base.dayOfMonth,
    month: base.month,
    year: base.year,
    moonPhase: base.moonPhase,
    season: base.season
  };
}

export function getSeasonForMonth(month) {
  if (["abadius", "calistril", "kuthona"].includes(month)) return "winter";
  if (["pharast", "gozran", "desnus"].includes(month)) return "spring";
  if (["sarenith", "erastus", "arodus"].includes(month)) return "summer";
  return "autumn";
}

function indexOrZero(list, value) {
  const index = list.indexOf(value);
  return index >= 0 ? index : 0;
}

function clampDay(month, day) {
  const max = MONTH_LENGTHS[month] ?? 30;
  return Math.max(1, Math.min(Number(day) || 1, max));
}

export function normalizeCalendarState(calendar = {}) {
  const fallback = defaultCalendarState();
  const month = MONTHS.includes(calendar.month) ? calendar.month : fallback.month;
  return {
    timeSegment: TIME_SEGMENTS.includes(calendar.timeSegment) ? calendar.timeSegment : fallback.timeSegment,
    weekday: WEEKDAYS.includes(calendar.weekday) ? calendar.weekday : fallback.weekday,
    dayOfMonth: clampDay(month, calendar.dayOfMonth ?? fallback.dayOfMonth),
    month,
    year: Number(calendar.year) || fallback.year,
    moonPhase: MOON_PHASES.includes(calendar.moonPhase) ? calendar.moonPhase : calculateMoonPhase(calendar.year ?? fallback.year, month, calendar.dayOfMonth ?? fallback.dayOfMonth),
    season: calendar.season && ["spring", "summer", "autumn", "winter"].includes(calendar.season) ? calendar.season : getSeasonForMonth(month)
  };
}

export function applyCalendarToWeather(weather, calendar) {
  const normalized = normalizeCalendarState(calendar);
  return {
    ...weather,
    timeSegment: normalized.timeSegment,
    weekday: normalized.weekday,
    dayOfMonth: normalized.dayOfMonth,
    month: normalized.month,
    year: normalized.year,
    moonPhase: normalized.moonPhase,
    season: normalized.season
  };
}

export function extractCalendarFromWeather(weather) {
  return normalizeCalendarState({
    timeSegment: weather?.timeSegment,
    weekday: weather?.weekday,
    dayOfMonth: weather?.dayOfMonth,
    month: weather?.month,
    year: weather?.year,
    moonPhase: weather?.moonPhase,
    season: weather?.season
  });
}

export function getNextTimeSegment(segment) {
  const index = indexOrZero(TIME_SEGMENTS, segment);
  return TIME_SEGMENTS[(index + 1) % TIME_SEGMENTS.length];
}

export function getPreviousTimeSegment(segment) {
  const index = indexOrZero(TIME_SEGMENTS, segment);
  return TIME_SEGMENTS[(index - 1 + TIME_SEGMENTS.length) % TIME_SEGMENTS.length];
}

export function shouldAdvanceDate(fromSegment, toSegment) {
  return fromSegment === "evening" && toSegment === "night";
}

export function shouldRewindDate(fromSegment, toSegment) {
  return fromSegment === "night" && toSegment === "evening";
}

export function calculateMoonPhase(year, month, dayOfMonth) {
  const monthIndex = indexOrZero(MONTHS, month);
  const yearNumber = Number(year) || 4726;
  const dayNumber = Number(dayOfMonth) || 1;
  const dayOfYear = MONTHS.slice(0, monthIndex).reduce((sum, key) => sum + (MONTH_LENGTHS[key] ?? 30), 0) + dayNumber;
  const totalDays = (yearNumber * 365) + dayOfYear;
  return MOON_PHASES[Math.floor((totalDays % 29.5) / 29.5 * MOON_PHASES.length) % MOON_PHASES.length];
}

export function advanceCalendarDate(calendar, days = 1) {
  let next = normalizeCalendarState(calendar);
  const direction = days >= 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(days); i += 1) {
    if (direction > 0) {
      next.dayOfMonth += 1;
      const maxDay = MONTH_LENGTHS[next.month] ?? 30;
      if (next.dayOfMonth > maxDay) {
        next.dayOfMonth = 1;
        const monthIndex = indexOrZero(MONTHS, next.month);
        next.month = MONTHS[(monthIndex + 1) % MONTHS.length];
        if (next.month === MONTHS[0]) next.year += 1;
      }
      next.weekday = WEEKDAYS[(indexOrZero(WEEKDAYS, next.weekday) + 1) % WEEKDAYS.length];
    } else {
      next.dayOfMonth -= 1;
      if (next.dayOfMonth < 1) {
        const monthIndex = indexOrZero(MONTHS, next.month);
        next.month = MONTHS[(monthIndex - 1 + MONTHS.length) % MONTHS.length];
        if (next.month === MONTHS[MONTHS.length - 1]) next.year -= 1;
        next.dayOfMonth = MONTH_LENGTHS[next.month] ?? 30;
      }
      next.weekday = WEEKDAYS[(indexOrZero(WEEKDAYS, next.weekday) - 1 + WEEKDAYS.length) % WEEKDAYS.length];
    }
    next.season = getSeasonForMonth(next.month);
    next.moonPhase = calculateMoonPhase(next.year, next.month, next.dayOfMonth);
  }
  return next;
}

export function advanceTimeSegment(calendar) {
  const current = normalizeCalendarState(calendar);
  const nextSegment = getNextTimeSegment(current.timeSegment);
  let next = { ...current, timeSegment: nextSegment };
  if (shouldAdvanceDate(current.timeSegment, nextSegment)) next = advanceCalendarDate(next, 1);
  return normalizeCalendarState(next);
}

export function rewindTimeSegment(calendar) {
  const current = normalizeCalendarState(calendar);
  const previousSegment = getPreviousTimeSegment(current.timeSegment);
  let next = { ...current, timeSegment: previousSegment };
  if (shouldRewindDate(current.timeSegment, previousSegment)) next = advanceCalendarDate(next, -1);
  return normalizeCalendarState(next);
}

export function calendarFromFormData(fd) {
  const month = fd.get("calendarMonth") || fd.get("month") || defaultCalendarState().month;
  return normalizeCalendarState({
    timeSegment: fd.get("calendarTimeSegment") || fd.get("timeSegment"),
    weekday: fd.get("calendarWeekday") || fd.get("weekday"),
    dayOfMonth: Number(fd.get("calendarDayOfMonth") || fd.get("dayOfMonth")),
    month,
    year: Number(fd.get("calendarYear") || fd.get("year")),
    season: getSeasonForMonth(month)
  });
}

export async function getCalendarState() {
  return normalizeCalendarState(game.settings.get(MODULE_ID, "calendarState") ?? defaultCalendarState());
}

export async function setCalendarState(calendar) {
  const normalized = normalizeCalendarState(calendar);
  await game.settings.set(MODULE_ID, "calendarState", normalized);
  const currentWeather = game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState();
  await game.settings.set(MODULE_ID, "weatherState", applyCalendarToWeather(currentWeather, normalized));
  return normalized;
}
