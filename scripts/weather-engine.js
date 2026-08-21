export const MODULE_ID = "pf2e-weather-forge";

export const TIME_SEGMENTS = ["morning", "noon", "afternoon", "evening", "night"];
export const EXTREME_FREQUENCIES = ["rare", "normal", "frequent", "veryFrequent"];

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
    dailyProfile: null,
    forecastInfluence: null,
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

function dateKey(weather) {
  return `${weather.year ?? 4726}-${weather.month ?? "abadius"}-${weather.dayOfMonth ?? 1}`;
}

function getSeasonalTemperatureRange(climate, season = "spring") {
  const normalizedSeason = ["spring", "summer", "autumn", "winter"].includes(season) ? season : "spring";
  return climate.seasonalTemp?.[normalizedSeason] ?? climate.temp ?? [0, 20];
}

function getDailyTemperatureAtSegment(profile, timeSegment) {
  const min = Number(profile?.minTemp ?? 10);
  const max = Number(profile?.maxTemp ?? min + 8);
  const span = Math.max(0, max - min);
  const factors = {
    night: 0,
    morning: 0.25,
    noon: 0.75,
    afternoon: 1,
    evening: 0.5
  };
  return Math.round(min + span * (factors[timeSegment] ?? 0.5));
}

function clampTemperatureForClimate(weather, climate, { allowExtremeOverflow = true } = {}) {
  const range = getSeasonalTemperatureRange(climate, weather.season);
  const overflow = allowExtremeOverflow && weather.extremeWeather ? 8 : 2;
  weather.temperature = clamp(weather.temperature, range[0] - overflow, range[1] + overflow);
  return weather;
}

function createDailyProfile(climate, weather, previousProfile = null, extremeWeather = null) {
  const range = getSeasonalTemperatureRange(climate, weather.season);
  const seasonalMin = range[0];
  const seasonalMax = range[1];
  const seasonalSpan = Math.max(4, seasonalMax - seasonalMin);

  const previousMid = previousProfile
    ? Math.round(((previousProfile.minTemp ?? seasonalMin) + (previousProfile.maxTemp ?? seasonalMax)) / 2)
    : randomInt(seasonalMin + 2, seasonalMax - 2);

  let dayMid = clamp(previousMid + randomInt(-3, 3), seasonalMin + 2, seasonalMax - 2);
  let daySpan = clamp(Math.round(seasonalSpan * 0.28) + randomInt(-2, 3), 4, 14);

  if (extremeWeather?.type === "heatwave") dayMid += 4 + (extremeWeather.intensity ?? 1) * 2;
  if (extremeWeather?.type === "coldSnap" || extremeWeather?.type === "blizzard") dayMid -= 4 + (extremeWeather.intensity ?? 1) * 2;
  if (weather.cloudDensity > 75 || weather.precipitation === "heavyRain") daySpan = Math.max(3, daySpan - 2);
  if (["desert", "mediterranean"].includes(weather.climateZone)) daySpan += 2;
  if (["coastal", "swamp", "tropical"].includes(weather.climateZone)) daySpan = Math.max(3, daySpan - 2);

  let minTemp = Math.round(dayMid - daySpan / 2);
  let maxTemp = Math.round(dayMid + daySpan / 2);
  const overflow = extremeWeather ? 8 : 0;
  minTemp = clamp(minTemp, seasonalMin - overflow, seasonalMax + overflow);
  maxTemp = clamp(maxTemp, minTemp + 2, seasonalMax + overflow);

  const previousAverage = previousProfile ? Math.round(((previousProfile.minTemp ?? minTemp) + (previousProfile.maxTemp ?? maxTemp)) / 2) : null;
  const currentAverage = Math.round((minTemp + maxTemp) / 2);
  let trend = "stable";
  if (previousAverage !== null && currentAverage >= previousAverage + 2) trend = "warmer";
  if (previousAverage !== null && currentAverage <= previousAverage - 2) trend = "cooler";

  return {
    dateKey: dateKey(weather),
    minTemp,
    maxTemp,
    trend,
    weatherPattern: extremeWeather?.type ?? (weather.cloudDensity > 70 ? "cloudy" : "fair")
  };
}

function ensureDailyProfile(weather, climate, activeExtreme = null, previousProfile = null) {
  if (weather.dailyProfile?.dateKey === dateKey(weather)) return weather.dailyProfile;
  return createDailyProfile(climate, weather, previousProfile ?? weather.dailyProfile, activeExtreme);
}

function timeWeightedRainChance(baseRainChance, timeSegment, cloudDensity, humidity) {
  let chance = baseRainChance;
  if (timeSegment === "afternoon") chance += 8;
  if (timeSegment === "evening") chance += 5;
  if (timeSegment === "morning") chance += 3;
  if (timeSegment === "night") chance -= 4;
  if (cloudDensity > 80) chance += 15;
  if (humidity > 80) chance += 8;
  return clamp(chance, 0, 95);
}

function choosePrecipitation(rainChance, cloudDensity, extremeWeather, weather = {}) {
  if (extremeWeather?.type === "storm") return "heavyRain";
  if (extremeWeather?.type === "blizzard") return "snow";
  if (["night", "morning"].includes(weather.timeSegment) && weather.humidity >= 78 && weather.cloudDensity >= 45 && randomInt(1, 100) <= 25) return "mist";
  const roll = randomInt(1, 100);
  if (roll > timeWeightedRainChance(rainChance, weather.timeSegment, cloudDensity, weather.humidity ?? 50)) return "none";
  if (cloudDensity > 85 && ["afternoon", "evening"].includes(weather.timeSegment) && randomInt(1, 100) <= 20) return "thunderstorm";
  if (cloudDensity > 80) return "rain";
  if (cloudDensity > 60) return "lightRain";
  return "drizzle";
}

function maybeStartExtremeWeather(climate, settings, weather = {}) {
  if (settings.forceExtreme) {
    return { type: settings.extremeType || "storm", intensity: 2, remainingSegments: randomInt(4, 12), decayChance: 12, phase: "building" };
  }
  if (!settings.allowExtreme) return null;
  let chance = climate.extremeChance;
  const frequency = settings.extremeFrequency || "normal";
  const frequencyMultiplier = { rare: 0.5, normal: 1, frequent: 1.8, veryFrequent: 3 }[frequency] ?? 1;
  if (["afternoon", "evening"].includes(weather.timeSegment)) chance += 2;
  if (weather.cloudDensity > 85) chance += 2;
  chance = clamp(Math.round(chance * frequencyMultiplier), 0, 45);
  if (randomInt(1, 100) <= chance) {
    const candidates = ["storm", "heatwave", "coldSnap", "fog", "blizzard"];
    const type = candidates[randomInt(0, candidates.length - 1)];
    const longDuration = ["heatwave", "coldSnap"].includes(type);
    return {
      type,
      intensity: randomInt(1, 3),
      remainingSegments: longDuration ? randomInt(10, 28) : randomInt(4, 14),
      decayChance: longDuration ? 8 : 14,
      phase: "building"
    };
  }
  return null;
}

function progressExtremeWeather(extremeWeather) {
  if (!extremeWeather) return null;
  const remainingSegments = Math.max(0, (extremeWeather.remainingSegments ?? 1) - 1);
  if (remainingSegments <= 0) return null;

  const next = { ...extremeWeather, remainingSegments };
  if (randomInt(1, 100) <= (next.decayChance ?? 12)) {
    next.intensity = clamp((next.intensity ?? 1) - 1, 0, 3);
    next.phase = "fading";
    if (next.intensity <= 0) return null;
  } else if (randomInt(1, 100) <= 15) {
    next.intensity = clamp((next.intensity ?? 1) + randomInt(-1, 1), 1, 3);
  }

  if (remainingSegments <= 2) next.phase = "fading";
  else if ((extremeWeather.remainingSegments ?? 0) - remainingSegments < 2) next.phase = "building";
  else next.phase = "active";
  return next;
}

function applyExtremeModifiers(weather) {
  const extreme = weather.extremeWeather;
  if (!extreme) return weather;
  const intensity = extreme.intensity ?? 1;
  if (extreme.type === "storm") {
    weather.windStrength = clamp(weather.windStrength + 3 + intensity, 0, 12);
    weather.cloudDensity = clamp(weather.cloudDensity + 25, 0, 100);
    weather.precipitation = weather.timeSegment === "afternoon" || weather.timeSegment === "evening" ? "thunderstorm" : "heavyRain";
  }
  if (extreme.type === "heatwave") {
    weather.temperature += 4 + intensity * 2;
    weather.humidity = clamp(weather.humidity - 10, 0, 100);
    weather.cloudDensity = clamp(weather.cloudDensity - 20, 0, 100);
  }
  if (extreme.type === "coldSnap") weather.temperature -= 4 + intensity * 2;
  if (extreme.type === "fog") {
    weather.humidity = clamp(weather.humidity + 20, 0, 100);
    weather.cloudDensity = clamp(weather.cloudDensity + 15, 0, 100);
    if (["night", "morning"].includes(weather.timeSegment)) weather.precipitation = "mist";
  }
  if (extreme.type === "blizzard") {
    weather.temperature -= 8;
    weather.windStrength = clamp(weather.windStrength + 4, 0, 12);
    weather.precipitation = "snow";
    weather.cloudDensity = 100;
  }
  return weather;
}


function blendNumber(current, target, strength = 0.75) {
  return Math.round((Number(current) * (1 - strength)) + (Number(target) * strength));
}

function applyForecastGuidance(weather, guidance) {
  if (!guidance) {
    weather.forecastInfluence = null;
    return weather;
  }
  const strength = clamp(Number(guidance.guidanceStrength ?? 0.75), 0.45, 0.9);
  weather.forecastInfluence = {
    dateKey: guidance.dateKey,
    weatherKey: guidance.weatherKey,
    confidence: guidance.confidence,
    rainRisk: guidance.rainRisk,
    stormRisk: guidance.stormRisk
  };
  weather.humidity = clamp(blendNumber(weather.humidity ?? 50, guidance.humidity ?? weather.humidity ?? 50, strength), 0, 100);
  weather.cloudDensity = clamp(blendNumber(weather.cloudDensity ?? 45, guidance.cloudCover ?? weather.cloudDensity ?? 45, strength), 0, 100);
  weather.windStrength = clamp(blendNumber(weather.windStrength ?? 2, guidance.wind ?? weather.windStrength ?? 2, Math.min(0.65, strength)), 0, 12);

  if (weather.dailyProfile) {
    weather.dailyProfile = {
      ...weather.dailyProfile,
      minTemp: blendNumber(weather.dailyProfile.minTemp ?? weather.temperature, guidance.minTemp ?? weather.dailyProfile.minTemp ?? weather.temperature, strength),
      maxTemp: blendNumber(weather.dailyProfile.maxTemp ?? weather.temperature, guidance.maxTemp ?? weather.dailyProfile.maxTemp ?? weather.temperature, strength),
      trend: guidance.trend ?? weather.dailyProfile.trend,
      weatherPattern: guidance.weatherKey ?? weather.dailyProfile.weatherPattern
    };
  }

  if (!weather.extremeWeather && guidance.driver?.type) {
    if (guidance.driver.type === "heatwave") weather.extremeWeather = { type: "heatwave", intensity: guidance.driver.strength ?? 1, remainingSegments: randomInt(3, 8), decayChance: 14, phase: "building" };
    if (guidance.driver.type === "coldSnap") weather.extremeWeather = { type: "coldSnap", intensity: guidance.driver.strength ?? 1, remainingSegments: randomInt(3, 8), decayChance: 14, phase: "building" };
    if (guidance.driver.type === "blizzard") weather.extremeWeather = { type: "blizzard", intensity: guidance.driver.strength ?? 1, remainingSegments: randomInt(3, 8), decayChance: 14, phase: "building" };
  }
  return weather;
}

function descriptionKeyFor(weather) {
  if (weather.extremeWeather) return `description.extreme.${weather.extremeWeather.type}`;
  if (weather.precipitation === "thunderstorm") return "description.thunderstorm";
  if (weather.precipitation === "heavyRain") return "description.heavyRain";
  if (["rain", "lightRain", "drizzle"].includes(weather.precipitation)) return "description.lightRain";
  if (weather.precipitation === "mist") return "description.mist";
  if (weather.precipitation === "snow") return "description.snow";
  if (weather.cloudDensity > 75) return "description.overcast";
  if (weather.windStrength >= 6) return "description.windy";
  if (weather.temperature <= 0) return "description.coldClear";
  if (weather.temperature >= 28) return "description.hotClear";
  return "description.clearMild";
}

export function createInitialWeatherState(climateZone = "temperate", calendar = {}) {
  const climate = CLIMATE_ZONES[climateZone] ?? CLIMATE_ZONES.temperate;
  const base = { ...defaultWeatherState(), ...calendar, climateZone };
  const weather = {
    ...base,
    humidity: randomInt(...climate.humidity),
    cloudDensity: randomInt(15, 65),
    windStrength: randomInt(...climate.wind),
    precipitation: "none",
    extremeWeather: null
  };
  weather.dailyProfile = createDailyProfile(climate, weather, null, null);
  weather.temperature = getDailyTemperatureAtSegment(weather.dailyProfile, weather.timeSegment);
  weather.precipitation = choosePrecipitation(Math.max(0, climate.rainChance - 10), weather.cloudDensity, null, weather);
  clampTemperatureForClimate(weather, climate, { allowExtremeOverflow: false });
  weather.descriptionKey = descriptionKeyFor(weather);
  return weather;
}

export function generateWeatherForTarget(current, targetCalendar = {}, settings = {}) {
  const climateZone = settings.climateZone || current.climateZone || "temperate";
  const climate = CLIMATE_ZONES[climateZone] ?? CLIMATE_ZONES.temperate;
  const targetSegment = TIME_SEGMENTS.includes(targetCalendar.timeSegment) ? targetCalendar.timeSegment : getNextTimeSegment(current.timeSegment);
  const target = {
    ...current,
    ...targetCalendar,
    timeSegment: targetSegment,
    climateZone
  };
  const activeExtreme = progressExtremeWeather(current.extremeWeather) ?? maybeStartExtremeWeather(climate, settings, target);

  let weather = {
    ...target,
    humidity: clamp((current.humidity ?? randomInt(...climate.humidity)) + randomInt(-8, 8), 0, 100),
    cloudDensity: clamp((current.cloudDensity ?? 45) + randomInt(-18, 18), 0, 100),
    windStrength: clamp((current.windStrength ?? 2) + randomInt(-2, 2), 0, 12),
    extremeWeather: activeExtreme
  };

  const newDayStarted = dateKey(current) !== dateKey(weather) || weather.dailyProfile?.dateKey !== dateKey(weather);
  weather.dailyProfile = ensureDailyProfile(weather, climate, activeExtreme, newDayStarted ? current.dailyProfile : weather.dailyProfile);
  const forecastGuidance = (settings.forecast?.entries ?? []).find(entry => entry.dateKey === dateKey(weather));
  weather = applyForecastGuidance(weather, forecastGuidance);
  weather.temperature = getDailyTemperatureAtSegment(weather.dailyProfile, weather.timeSegment);

  const forecastRainBias = forecastGuidance ? Math.round(((forecastGuidance.rainRisk ?? climate.rainChance) - climate.rainChance) * 0.65) : 0;
  weather.precipitation = choosePrecipitation(clamp(climate.rainChance + forecastRainBias, 0, 95), weather.cloudDensity, weather.extremeWeather, weather);
  weather = applyExtremeModifiers(weather);
  weather = clampTemperatureForClimate(weather, climate);
  weather.descriptionKey = descriptionKeyFor(weather);
  return weather;
}

export function generateNextWeather(current, settings = {}) {
  const climateZone = settings.climateZone || current.climateZone || "temperate";
  const climate = CLIMATE_ZONES[climateZone] ?? CLIMATE_ZONES.temperate;
  const nextSegment = getNextTimeSegment(current.timeSegment);
  const activeExtreme = progressExtremeWeather(current.extremeWeather) ?? maybeStartExtremeWeather(climate, settings, { ...current, timeSegment: nextSegment });

  let weather = {
    ...current,
    timeSegment: nextSegment,
    climateZone,
    humidity: clamp((current.humidity ?? randomInt(...climate.humidity)) + randomInt(-8, 8), 0, 100),
    cloudDensity: clamp((current.cloudDensity ?? 45) + randomInt(-18, 18), 0, 100),
    windStrength: clamp((current.windStrength ?? 2) + randomInt(-2, 2), 0, 12),
    extremeWeather: activeExtreme
  };

  const previousDateKey = dateKey(weather);
  if (shouldAdvanceDate(current.timeSegment, nextSegment)) weather = advanceCalendarDate(weather);
  const newDayStarted = previousDateKey !== dateKey(weather) || weather.dailyProfile?.dateKey !== dateKey(weather);
  weather.dailyProfile = ensureDailyProfile(weather, climate, activeExtreme, newDayStarted ? current.dailyProfile : weather.dailyProfile);
  const forecastGuidance = (settings.forecast?.entries ?? []).find(entry => entry.dateKey === dateKey(weather));
  weather = applyForecastGuidance(weather, forecastGuidance);
  weather.temperature = getDailyTemperatureAtSegment(weather.dailyProfile, weather.timeSegment);

  const forecastRainBias = forecastGuidance ? Math.round(((forecastGuidance.rainRisk ?? climate.rainChance) - climate.rainChance) * 0.65) : 0;
  weather.precipitation = choosePrecipitation(clamp(climate.rainChance + forecastRainBias, 0, 95), weather.cloudDensity, weather.extremeWeather, weather);
  weather = applyExtremeModifiers(weather);
  weather = clampTemperatureForClimate(weather, climate);
  weather.descriptionKey = descriptionKeyFor(weather);
  return weather;
}
