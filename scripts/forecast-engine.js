import { MODULE_ID, CLIMATE_ZONES, MONTHS, MONTH_LENGTHS } from "./weather-engine.js";
import { advanceCalendarDate, extractCalendarFromWeather } from "./calendar-engine.js";

export const FORECAST_DAYS = ["1", "3", "5", "7"];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dateKey(calendar) {
  return `${calendar.year ?? 4726}-${calendar.month ?? "abadius"}-${calendar.dayOfMonth ?? 1}`;
}

function getSeasonalRange(climateZone, season) {
  const climate = CLIMATE_ZONES[climateZone] ?? CLIMATE_ZONES.temperate;
  return climate.seasonalTemp?.[season] ?? [0, 20];
}

function averageTempFromWeather(weather) {
  const min = Number(weather?.dailyProfile?.minTemp ?? weather?.temperature ?? 12);
  const max = Number(weather?.dailyProfile?.maxTemp ?? weather?.temperature ?? min + 6);
  return Math.round((min + max) / 2);
}

function classifyMainWeather(rainRisk, stormRisk, cloudCover, extremeType = null) {
  if (extremeType === "heatwave") return "heatwave";
  if (extremeType === "coldSnap") return "coldSnap";
  if (extremeType === "blizzard") return "blizzard";
  if (stormRisk >= 35) return "stormPossible";
  if (rainRisk >= 70) return "rainLikely";
  if (rainRisk >= 40) return "rainPossible";
  if (cloudCover >= 75) return "overcast";
  if (cloudCover >= 45) return "cloudy";
  return "fair";
}

function chooseAtmosphericDriver(current, dayIndex, climateZone) {
  const climate = CLIMATE_ZONES[climateZone] ?? CLIMATE_ZONES.temperate;
  const currentClouds = Number(current.cloudDensity ?? 45);
  const currentHumidity = Number(current.humidity ?? 60);
  const currentExtreme = current.extremeWeather?.type ?? null;
  if (currentExtreme && dayIndex <= 2) return { type: currentExtreme, strength: current.extremeWeather?.intensity ?? 1 };

  const wetSignal = currentClouds + currentHumidity + climate.rainChance;
  if (wetSignal > 190 && randomInt(1, 100) <= 70) return { type: "lowPressure", strength: randomInt(1, 3) };
  if (wetSignal < 105 && randomInt(1, 100) <= 65) return { type: "highPressure", strength: randomInt(1, 3) };
  if (["coastal", "temperate", "mountain"].includes(climateZone) && randomInt(1, 100) <= 22 + dayIndex * 4) return { type: "coldFront", strength: randomInt(1, 3) };
  if (["mediterranean", "desert", "tropical"].includes(climateZone) && randomInt(1, 100) <= 16 + dayIndex * 3) return { type: "warmFront", strength: randomInt(1, 3) };
  return { type: "stableAir", strength: 1 };
}

function buildForecastEntry(current, baseCalendar, dayIndex, previousAverage) {
  const calendar = advanceCalendarDate(baseCalendar, dayIndex);
  const climateZone = current.climateZone ?? "temperate";
  const climate = CLIMATE_ZONES[climateZone] ?? CLIMATE_ZONES.temperate;
  const [seasonalMin, seasonalMax] = getSeasonalRange(climateZone, calendar.season);
  const driver = chooseAtmosphericDriver(current, dayIndex, climateZone);
  const confidence = clamp(90 - (dayIndex - 1) * 8 - randomInt(0, 8), 45, 90);

  let avg = previousAverage + randomInt(-2, 2);
  let cloudCover = clamp(Number(current.cloudDensity ?? 45) + randomInt(-18, 18) + dayIndex * randomInt(-2, 3), 0, 100);
  let humidity = clamp(Number(current.humidity ?? 60) + randomInt(-12, 12), 0, 100);
  let wind = clamp(Number(current.windStrength ?? 2) + randomInt(-1, 2), 0, 12);
  let rainRisk = climate.rainChance + Math.round((humidity - 55) * 0.35) + Math.round((cloudCover - 50) * 0.45) + randomInt(-8, 12);
  let stormRisk = Math.round(rainRisk * 0.22) + (calendar.season === "summer" ? 8 : 0) + randomInt(-5, 8);

  if (driver.type === "coldFront") {
    avg -= 2 + driver.strength;
    cloudCover += 18 + driver.strength * 5;
    humidity += 12;
    wind += 2 + driver.strength;
    rainRisk += 22;
    stormRisk += 8;
  } else if (driver.type === "warmFront") {
    avg += 2 + driver.strength;
    humidity += 8;
    cloudCover += 8;
    rainRisk += 10;
  } else if (driver.type === "lowPressure") {
    cloudCover += 20;
    humidity += 12;
    rainRisk += 25;
    wind += driver.strength;
  } else if (driver.type === "highPressure") {
    cloudCover -= 24;
    humidity -= 10;
    rainRisk -= 22;
    stormRisk -= 10;
  } else if (driver.type === "heatwave") {
    avg += 5;
    cloudCover -= 18;
    humidity -= 12;
    rainRisk -= 18;
  } else if (driver.type === "coldSnap") {
    avg -= 5;
    rainRisk -= 8;
  } else if (driver.type === "blizzard") {
    avg -= 8;
    cloudCover = 100;
    humidity += 15;
    rainRisk += 35;
    wind += 4;
  }

  avg = clamp(avg, seasonalMin + 2, seasonalMax - 2);
  cloudCover = clamp(cloudCover, 0, 100);
  humidity = clamp(humidity, 0, 100);
  wind = clamp(wind, 0, 12);
  rainRisk = clamp(rainRisk, 0, 95);
  stormRisk = clamp(stormRisk, 0, 75);

  const span = clamp(Math.round((seasonalMax - seasonalMin) * 0.25) + randomInt(-2, 3), 4, 14);
  const minTemp = clamp(Math.round(avg - span / 2), seasonalMin - 4, seasonalMax + 4);
  const maxTemp = clamp(Math.round(avg + span / 2), minTemp + 2, seasonalMax + 4);
  const trend = avg >= previousAverage + 2 ? "warmer" : avg <= previousAverage - 2 ? "cooler" : "stable";
  const weatherKey = classifyMainWeather(rainRisk, stormRisk, cloudCover, driver.type);

  return {
    dateKey: dateKey(calendar),
    dayOffset: dayIndex,
    calendar,
    climateZone,
    driver,
    trend,
    minTemp,
    maxTemp,
    rainRisk,
    stormRisk,
    cloudCover,
    humidity,
    wind,
    confidence,
    weatherKey,
    guidanceStrength: confidence / 100
  };
}

export function defaultForecastState() {
  return {
    generatedFrom: null,
    days: 3,
    entries: []
  };
}

export function generateForecast(currentWeather, days = 3) {
  const count = clamp(Number(days) || 3, 1, 7);
  const baseCalendar = extractCalendarFromWeather(currentWeather);
  let previousAverage = averageTempFromWeather(currentWeather);
  const entries = [];
  for (let day = 1; day <= count; day += 1) {
    const entry = buildForecastEntry(currentWeather, baseCalendar, day, previousAverage);
    entries.push(entry);
    previousAverage = Math.round((entry.minTemp + entry.maxTemp) / 2);
  }
  return {
    generatedFrom: dateKey(baseCalendar),
    climateZone: currentWeather.climateZone ?? "temperate",
    days: count,
    entries
  };
}

export function getForecastState() {
  return game.settings.get(MODULE_ID, "forecastState") ?? defaultForecastState();
}

export async function setForecastState(forecast) {
  await game.settings.set(MODULE_ID, "forecastState", forecast ?? defaultForecastState());
  return forecast;
}

export function getForecastGuidanceForWeather(forecast, weather) {
  const key = dateKey(weather);
  return (forecast?.entries ?? []).find(entry => entry.dateKey === key) ?? null;
}

export function forecastDescriptorKey(entry) {
  return entry?.weatherKey ?? "fair";
}

export function forecastDriverKey(entry) {
  return entry?.driver?.type ?? "stableAir";
}
