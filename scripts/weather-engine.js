export const MODULE_ID = "pf2e-weather-forge";

export const TIME_SEGMENTS = ["morning", "noon", "afternoon", "evening", "night"];

export const WEEKDAYS = ["moonday", "toilday", "wealday", "oathday", "fireday", "starday", "sunday"];
export const MONTHS = ["abadius", "calistril", "pharast", "gozran", "desnus", "sarenith", "erastus", "arodus", "rova", "lamashan", "neth", "kuthona"];
const MOON_PHASES = ["newMoon", "waxingCrescent", "firstQuarter", "waxingGibbous", "fullMoon", "waningGibbous", "lastQuarter", "waningCrescent"];
export const MONTH_LENGTHS = {
  abadius: 31,
  calistril: 28,
  pharast: 31,
  gozran: 30,
  desnus: 31,
  sarenith: 30,
  erastus: 31,
  arodus: 31,
  rova: 30,
  lamashan: 31,
  neth: 30,
  kuthona: 31
};

export const CLIMATE_ZONES = {
  temperate: {
    seasonalTemp: { winter: [-4, 8], spring: [6, 20], summer: [16, 30], autumn: [5, 18] },
    humidity: [45, 80], rainChance: 35, wind: [1, 4], extremeChance: 4
  },
  mediterranean: {
    seasonalTemp: { winter: [5, 18], spring: [12, 24], summer: [20, 40], autumn: [15, 28] },
    humidity: [35, 70], rainChance: 22, wind: [1, 5], extremeChance: 5
  },
  coastal: {
    seasonalTemp: { winter: [2, 12], spring: [7, 17], summer: [14, 24], autumn: [7, 18] },
    humidity: [60, 90], rainChance: 45, wind: [2, 6], extremeChance: 6
  },
  arctic: {
    seasonalTemp: { winter: [-35, -8], spring: [-18, 2], summer: [-2, 10], autumn: [-15, 2] },
    humidity: [35, 75], rainChance: 20, wind: [2, 7], extremeChance: 7
  },
  desert: {
    seasonalTemp: { winter: [5, 24], spring: [16, 34], summer: [28, 48], autumn: [14, 34] },
    humidity: [5, 30], rainChance: 5, wind: [1, 6], extremeChance: 5
  },
  tropical: {
    seasonalTemp: { winter: [20, 30], spring: [22, 32], summer: [24, 36], autumn: [22, 32] },
    humidity: [70, 98], rainChance: 60, wind: [1, 5], extremeChance: 8
  },
  mountain: {
    seasonalTemp: { winter: [-18, 2], spring: [-4, 12], summer: [4, 22], autumn: [-4, 12] },
    humidity: [35, 85], rainChance: 40, wind: [2, 8], extremeChance: 8
  },
  swamp: {
    seasonalTemp: { winter: [8, 20], spring: [14, 28], summer: [20, 34], autumn: [14, 28] },
    humidity: [80, 100], rainChance: 55, wind: [0, 3], extremeChance: 5
  },
  magical: {
    seasonalTemp: { winter: [-20, 45], spring: [-20, 45], summer: [-20, 45], autumn: [-20, 45] },
    humidity: [10, 100], rainChance: 50, wind: [0, 10], extremeChance: 12
  }
};

export function defaultWeatherState() {
  return {
    timeSegment: "morning",
    climateZone: "temperate",
    temperature: 14,
    precipitation: "none",
    humidity: 60,
    cloudDensity: 45,
    windStrength: 2,
    weekday: "moonday",
    dayOfMonth: 1,
    month: "abadius",
    year: 4726,
    moonPhase: "waxingCrescent",
    season: "spring",
    extremeWeather: null,
    descriptionKey: "description.clearMild"
  };
}

export function getNextTimeSegment(segment) {
  const index = TIME_SEGMENTS.indexOf(segment);
  return TIME_SEGMENTS[(index + 1) % TIME_SEGMENTS.length] ?? "morning";
}

export function shouldAdvanceDate(fromSegment, toSegment) {
  return fromSegment === "evening" && toSegment === "night";
}

function getNextWeekday(weekday) {
  const index = WEEKDAYS.indexOf(weekday);
  return WEEKDAYS[(index + 1) % WEEKDAYS.length] ?? WEEKDAYS[0];
}

function getSeasonForMonth(month) {
  if (["abadius", "calistril", "kuthona"].includes(month)) return "winter";
  if (["pharast", "gozran", "desnus"].includes(month)) return "spring";
  if (["sarenith", "erastus", "arodus"].includes(month)) return "summer";
  return "autumn";
}

function calculateMoonPhase(year, month, dayOfMonth) {
  const monthIndex = Math.max(0, MONTHS.indexOf(month));
  const dayOfYear = MONTHS.slice(0, monthIndex).reduce((sum, key) => sum + (MONTH_LENGTHS[key] ?? 30), 0) + (Number(dayOfMonth) || 1);
  const totalDays = ((Number(year) || 4726) * 365) + dayOfYear;
  return MOON_PHASES[Math.floor((totalDays % 29.5) / 29.5 * MOON_PHASES.length) % MOON_PHASES.length];
}

function advanceCalendarDate(weather) {
  const month = MONTHS.includes(weather.month) ? weather.month : MONTHS[0];
  const maxDay = MONTH_LENGTHS[month] ?? 30;
  let dayOfMonth = Number(weather.dayOfMonth ?? 1) + 1;
  let nextMonth = month;
  let year = Number(weather.year ?? 4726);

  if (dayOfMonth > maxDay) {
    dayOfMonth = 1;
    const monthIndex = MONTHS.indexOf(month);
    nextMonth = MONTHS[(monthIndex + 1) % MONTHS.length] ?? MONTHS[0];
    if (nextMonth === MONTHS[0]) year += 1;
  }

  return {
    ...weather,
    weekday: getNextWeekday(weather.weekday),
    dayOfMonth,
    month: nextMonth,
    year,
    season: getSeasonForMonth(nextMonth),
    moonPhase: calculateMoonPhase(year, nextMonth, dayOfMonth)
  };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getSeasonalTemperatureRange(climate, season = "spring") {
  const normalizedSeason = ["spring", "summer", "autumn", "winter"].includes(season) ? season : "spring";
  return climate.seasonalTemp?.[normalizedSeason] ?? climate.temp ?? [0, 20];
}

function applyTimeOfDayTemperatureModifier(temperature, timeSegment) {
  if (timeSegment === "night") return temperature - randomInt(2, 5);
  if (timeSegment === "morning") return temperature - randomInt(0, 2);
  if (timeSegment === "noon" || timeSegment === "afternoon") return temperature + randomInt(1, 4);
  return temperature;
}

function clampTemperatureForClimate(weather, climate, { allowExtremeOverflow = true } = {}) {
  const range = getSeasonalTemperatureRange(climate, weather.season);
  const overflow = allowExtremeOverflow && weather.extremeWeather ? 8 : 2;
  weather.temperature = clamp(weather.temperature, range[0] - overflow, range[1] + overflow);
  return weather;
}

function choosePrecipitation(rainChance, cloudDensity, extremeWeather) {
  if (extremeWeather?.type === "storm") return "heavyRain";
  if (extremeWeather?.type === "blizzard") return "snow";
  const roll = randomInt(1, 100);
  if (roll > rainChance) return "none";
  if (cloudDensity > 80) return "rain";
  if (cloudDensity > 60) return "lightRain";
  return "drizzle";
}

function maybeStartExtremeWeather(climate, settings) {
  if (settings.forceExtreme) {
    return { type: settings.extremeType || "storm", intensity: 2, remainingSegments: randomInt(2, 5), decayChance: 25 };
  }
  if (!settings.allowExtreme) return null;
  if (randomInt(1, 100) <= climate.extremeChance) {
    const candidates = ["storm", "heatwave", "coldSnap", "fog", "blizzard"];
    return { type: candidates[randomInt(0, candidates.length - 1)], intensity: randomInt(1, 3), remainingSegments: randomInt(2, 6), decayChance: 20 };
  }
  return null;
}

function progressExtremeWeather(extremeWeather) {
  if (!extremeWeather) return null;
  const next = { ...extremeWeather, remainingSegments: extremeWeather.remainingSegments - 1 };
  if (next.remainingSegments <= 0 || randomInt(1, 100) <= next.decayChance) return null;
  if (randomInt(1, 100) <= 20) next.intensity = clamp(next.intensity + randomInt(-1, 1), 1, 3);
  return next;
}

function applyExtremeModifiers(weather) {
  const extreme = weather.extremeWeather;
  if (!extreme) return weather;
  const intensity = extreme.intensity ?? 1;
  if (extreme.type === "storm") {
    weather.windStrength = clamp(weather.windStrength + 3 + intensity, 0, 12);
    weather.cloudDensity = clamp(weather.cloudDensity + 25, 0, 100);
    weather.precipitation = "heavyRain";
  }
  if (extreme.type === "heatwave") {
    weather.temperature += 6 + intensity * 2;
    weather.humidity = clamp(weather.humidity - 10, 0, 100);
    weather.cloudDensity = clamp(weather.cloudDensity - 20, 0, 100);
  }
  if (extreme.type === "coldSnap") weather.temperature -= 6 + intensity * 2;
  if (extreme.type === "fog") {
    weather.humidity = clamp(weather.humidity + 20, 0, 100);
    weather.cloudDensity = clamp(weather.cloudDensity + 15, 0, 100);
  }
  if (extreme.type === "blizzard") {
    weather.temperature -= 8;
    weather.windStrength = clamp(weather.windStrength + 4, 0, 12);
    weather.precipitation = "snow";
    weather.cloudDensity = 100;
  }
  return weather;
}

function descriptionKeyFor(weather) {
  if (weather.extremeWeather) return `description.extreme.${weather.extremeWeather.type}`;
  if (weather.precipitation === "heavyRain") return "description.heavyRain";
  if (["rain", "lightRain", "drizzle"].includes(weather.precipitation)) return "description.lightRain";
  if (weather.precipitation === "snow") return "description.snow";
  if (weather.cloudDensity > 75) return "description.overcast";
  if (weather.windStrength >= 6) return "description.windy";
  if (weather.temperature <= 0) return "description.coldClear";
  if (weather.temperature >= 28) return "description.hotClear";
  return "description.clearMild";
}

export function createInitialWeatherState(climateZone = "temperate", calendar = {}) {
  const climate = CLIMATE_ZONES[climateZone] ?? CLIMATE_ZONES.temperate;
  const base = { ...defaultWeatherState(), ...calendar };
  const tempRange = getSeasonalTemperatureRange(climate, base.season);
  const weather = {
    ...base,
    climateZone,
    temperature: applyTimeOfDayTemperatureModifier(randomInt(...tempRange), base.timeSegment),
    humidity: randomInt(...climate.humidity),
    cloudDensity: randomInt(15, 65),
    windStrength: randomInt(...climate.wind),
    precipitation: "none",
    extremeWeather: null
  };
  weather.precipitation = choosePrecipitation(Math.max(0, climate.rainChance - 10), weather.cloudDensity, null);
  clampTemperatureForClimate(weather, climate, { allowExtremeOverflow: false });
  weather.descriptionKey = descriptionKeyFor(weather);
  return weather;
}

export function generateNextWeather(current, settings = {}) {
  const climateZone = settings.climateZone || current.climateZone || "temperate";
  const climate = CLIMATE_ZONES[climateZone] ?? CLIMATE_ZONES.temperate;
  const nextSegment = getNextTimeSegment(current.timeSegment);
  const activeExtreme = progressExtremeWeather(current.extremeWeather) ?? maybeStartExtremeWeather(climate, settings);

  const season = current.season || "spring";
  const tempRange = getSeasonalTemperatureRange(climate, season);
  let temperature = (current.temperature ?? randomInt(...tempRange)) + randomInt(-3, 3);
  temperature = applyTimeOfDayTemperatureModifier(temperature, nextSegment);
  temperature = clamp(temperature, tempRange[0] - 2, tempRange[1] + 2);

  let weather = {
    ...current,
    timeSegment: nextSegment,
    climateZone,
    temperature,
    humidity: clamp((current.humidity ?? randomInt(...climate.humidity)) + randomInt(-10, 10), 0, 100),
    cloudDensity: clamp((current.cloudDensity ?? 45) + randomInt(-20, 20), 0, 100),
    windStrength: clamp((current.windStrength ?? 2) + randomInt(-2, 2), 0, 12),
    extremeWeather: activeExtreme
  };

  if (shouldAdvanceDate(current.timeSegment, nextSegment)) weather = advanceCalendarDate(weather);

  weather.precipitation = choosePrecipitation(climate.rainChance, weather.cloudDensity, weather.extremeWeather);
  weather = applyExtremeModifiers(weather);
  weather = clampTemperatureForClimate(weather, climate);
  weather.descriptionKey = descriptionKeyFor(weather);
  return weather;
}
