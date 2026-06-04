import { MODULE_ID } from "./weather-engine.js";

export const HISTORY_LIMITS = ["30", "90", "180", "365", "unlimited"];

export function defaultWeatherHistory() {
  return [];
}

function numberOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function getWeatherHistory() {
  const history = game.settings.get(MODULE_ID, "weatherHistory");
  return Array.isArray(history) ? history : [];
}

export async function setWeatherHistory(history) {
  await game.settings.set(MODULE_ID, "weatherHistory", Array.isArray(history) ? history : []);
}

export function getHistoryLimit() {
  const configured = String(game.settings.get(MODULE_ID, "historyLimit") ?? "90");
  return HISTORY_LIMITS.includes(configured) ? configured : "90";
}

export function makeHistoryDateKey(entryOrWeather) {
  return [
    numberOr(entryOrWeather?.year, 4726),
    entryOrWeather?.month ?? "abadius",
    numberOr(entryOrWeather?.dayOfMonth, 1)
  ].join("-");
}

export function createHistoryEntry(weather) {
  const entry = {
    id: foundry.utils.randomID(),
    createdAt: Date.now(),
    dateKey: makeHistoryDateKey(weather),
    year: numberOr(weather.year, 4726),
    month: weather.month ?? "abadius",
    dayOfMonth: numberOr(weather.dayOfMonth, 1),
    weekday: weather.weekday ?? "moonday",
    season: weather.season ?? "spring",
    moonPhase: weather.moonPhase ?? "newMoon",
    timeSegment: weather.timeSegment ?? "morning",
    climateZone: weather.climateZone ?? "temperate",
    temperature: numberOr(weather.temperature, 0),
    dailyMinTemp: numberOr(weather.dailyProfile?.minTemp, numberOr(weather.temperature, 0)),
    dailyMaxTemp: numberOr(weather.dailyProfile?.maxTemp, numberOr(weather.temperature, 0)),
    trend: weather.dailyProfile?.trend ?? "stable",
    precipitation: weather.precipitation ?? "none",
    humidity: numberOr(weather.humidity, 0),
    cloudDensity: numberOr(weather.cloudDensity, 0),
    windStrength: numberOr(weather.windStrength, 0),
    descriptionKey: weather.descriptionKey ?? "description.clearMild",
    extremeWeather: weather.extremeWeather
      ? {
          type: weather.extremeWeather.type ?? "storm",
          phase: weather.extremeWeather.phase ?? "active",
          intensity: numberOr(weather.extremeWeather.intensity, 1),
          remainingSegments: numberOr(weather.extremeWeather.remainingSegments, 0)
        }
      : null
  };
  return entry;
}

export function trimHistoryByLimit(history, limit = getHistoryLimit()) {
  if (limit === "unlimited") return history;
  const maxDays = Number(limit) || 90;
  const kept = [];
  const seenDateKeys = new Set();

  for (const entry of [...history].reverse()) {
    seenDateKeys.add(entry.dateKey ?? makeHistoryDateKey(entry));
    if (seenDateKeys.size > maxDays) break;
    kept.push(entry);
  }

  return kept.reverse();
}

export async function appendWeatherHistory(weather) {
  const history = getWeatherHistory();
  const next = trimHistoryByLimit([...history, createHistoryEntry(weather)]);
  await setWeatherHistory(next);
  return next;
}

export async function clearWeatherHistory() {
  await setWeatherHistory([]);
}

export function historyDescriptorKey(type, value) {
  if (type === "humidity") {
    if (value < 30) return "dry";
    if (value < 60) return "normal";
    if (value < 80) return "humid";
    return "veryHumid";
  }
  if (type === "cloudDensity") {
    if (value < 20) return "clear";
    if (value < 45) return "scattered";
    if (value < 75) return "cloudy";
    return "overcast";
  }
  if (type === "windStrength") {
    if (value <= 0) return "calm";
    if (value <= 2) return "breeze";
    if (value <= 5) return "windy";
    if (value <= 8) return "strong";
    return "violent";
  }
  return "normal";
}
