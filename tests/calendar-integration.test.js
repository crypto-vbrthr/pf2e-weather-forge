import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_DAYPART_BOUNDARIES, getDaypartForHour, mapMoonPhase, normalizeDaypartBoundaries } from "../scripts/calendar-source.js";
import { defaultCalendarDrivenState } from "../scripts/daypart-automation.js";
import { defaultWeatherState, generateWeatherForTarget } from "../scripts/weather-engine.js";
import { generateForecastFromCalendars } from "../scripts/forecast-engine.js";

test("default daypart boundaries map clock hours to the five Weather Forge phases", () => {
  assert.equal(getDaypartForHour(4, DEFAULT_DAYPART_BOUNDARIES), "night");
  assert.equal(getDaypartForHour(5, DEFAULT_DAYPART_BOUNDARIES), "morning");
  assert.equal(getDaypartForHour(11, DEFAULT_DAYPART_BOUNDARIES), "noon");
  assert.equal(getDaypartForHour(14, DEFAULT_DAYPART_BOUNDARIES), "afternoon");
  assert.equal(getDaypartForHour(18, DEFAULT_DAYPART_BOUNDARIES), "evening");
  assert.equal(getDaypartForHour(22, DEFAULT_DAYPART_BOUNDARIES), "night");
});

test("invalid daypart ordering falls back to the safe default schedule", () => {
  assert.deepEqual(normalizeDaypartBoundaries({ morning: 8, noon: 7, afternoon: 14, evening: 18, night: 22 }), { ...DEFAULT_DAYPART_BOUNDARIES });
});

test("Calendar Forge moon phase ids map to Weather Forge phase ids", () => {
  assert.equal(mapMoonPhase({ phase: "waxing-crescent", progress: 0.1 }), "waxingCrescent");
  assert.equal(mapMoonPhase({ phase: "full", progress: 0.5 }), "fullMoon");
  assert.equal(mapMoonPhase({ phase: "last-quarter", progress: 0.7 }), "lastQuarter");
});

test("targeted weather generation keeps the externally supplied date and phase", () => {
  const current = { ...defaultWeatherState(), timeSegment: "noon", month: "erastus", dayOfMonth: 12, year: 4726, season: "summer" };
  const target = { timeSegment: "afternoon", month: "erastus", dayOfMonth: 12, year: 4726, weekday: "fireday", moonPhase: "fullMoon", season: "summer" };
  const generated = generateWeatherForTarget(current, target, { climateZone: "temperate", allowExtreme: false, forecast: { entries: [] } });
  assert.equal(generated.timeSegment, "afternoon");
  assert.equal(generated.month, "erastus");
  assert.equal(generated.dayOfMonth, 12);
  assert.equal(generated.year, 4726);
  assert.equal(generated.moonPhase, "fullMoon");
});

test("forecast generation can consume Calendar Forge supplied future dates", () => {
  const current = defaultWeatherState();
  const calendars = [
    { ...current, dayOfMonth: 2, timeSegment: "morning" },
    { ...current, dayOfMonth: 3, timeSegment: "morning" }
  ];
  const forecast = generateForecastFromCalendars(current, calendars);
  assert.equal(forecast.entries.length, 2);
  assert.equal(forecast.entries[0].calendar.dayOfMonth, 2);
  assert.equal(forecast.entries[1].calendar.dayOfMonth, 3);
});

test("calendar-driven runtime state distinguishes current and resolved phases", () => {
  const state = defaultCalendarDrivenState();
  assert.equal(state.initialized, false);
  assert.equal(state.currentPhaseKey, null);
  assert.equal(state.resolvedPhaseKey, null);
  assert.equal(state.queuedPreview, null);
});

test("large Calendar Forge jumps resolve intermediate dayparts but leave only the current daypart open", async () => {
  const settings = new Map([
    ["calendarSourceMode", "calendarForge"],
    ["calendarForgeRegionId", ""],
    ["calendarForgeMoonId", ""],
    ["daypartAutomationMode", "manual"],
    ["daypartBoundaries", { ...DEFAULT_DAYPART_BOUNDARIES }],
    ["calendarDrivenState", defaultCalendarDrivenState()],
    ["weatherState", { ...defaultWeatherState(), timeSegment: "noon", season: "summer" }],
    ["weatherPreview", null],
    ["weatherHistory", []],
    ["historyLimit", "90"],
    ["allowExtreme", false],
    ["extremeFrequency", "normal"],
    ["forecastState", { generatedFrom: null, days: 3, entries: [] }]
  ]);

  const secondsPerDay = 86400;
  const makeContext = (worldTime) => {
    const dayIndex = Math.floor(worldTime / secondsPerDay);
    const inDay = ((worldTime % secondsPerDay) + secondsPerDay) % secondsPerDay;
    const hour = Math.floor(inDay / 3600);
    const minute = Math.floor((inDay % 3600) / 60);
    const day = dayIndex + 1;
    const weekdayIndex = ((dayIndex % 7) + 7) % 7;
    const weekdays = ["moonday", "toilday", "wealday", "oathday", "fireday", "starday", "sunday"];
    return {
      worldTime,
      region: null,
      regionId: null,
      calendar: { id: "test-calendar", label: "Test", year: 1, monthId: "m1", monthIndex: 0, day, weekdayId: weekdays[weekdayIndex], weekdayIndex, names: { month: "Month", weekday: weekdays[weekdayIndex] } },
      time: { hour, minute, second: 0 },
      season: { id: "summer", label: "Summer" },
      moons: [{ id: "moon", phase: "full", phaseLabel: "Full", progress: 0.5 }],
      formatted: { date: `${day}. Month 1`, time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` },
      raw: { calendar: { id: "test-calendar", time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 } } }
    };
  };
  const api = {
    getTemporalContext: async ({ worldTime = globalThis.game.time.worldTime } = {}) => makeContext(worldTime),
    toWorldTime: ({ day, hour = 0, minute = 0, second = 0 }) => (day - 1) * secondsPerDay + hour * 3600 + minute * 60 + second,
    regions: { list: () => [] },
    moonProfiles: { list: () => [] }
  };

  globalThis.foundry = { utils: { randomID: () => "test-id" } };
  globalThis.ui = { notifications: { info: () => {}, error: () => {} } };
  globalThis.game = {
    time: { worldTime: 13 * 3600 },
    user: { isGM: true },
    modules: new Map([["pf2e-calendar-forge", { active: true, api }]]),
    i18n: { localize: key => key, format: (key, data) => `${key}:${data?.daypart ?? ""}` },
    settings: {
      get: (_module, key) => settings.get(key),
      set: async (_module, key, value) => { settings.set(key, structuredClone(value)); return value; }
    }
  };

  const automation = await import("../scripts/daypart-automation.js");
  await automation.initializeCalendarDrivenWeather({ force: true });

  game.time.worldTime = 21 * 3600;
  const result = await automation.processCalendarWorldTimeChange(game.time.worldTime, 8 * 3600);
  assert.equal(result.boundaries, 2);
  const state = settings.get("calendarDrivenState");
  assert.match(state.currentPhaseKey, /:evening$/);
  assert.match(state.resolvedPhaseKey, /:afternoon$/);
  assert.equal(settings.get("weatherState").timeSegment, "afternoon");
  assert.equal(settings.get("weatherHistory").length, 1);

  const preview = await automation.generateCurrentPhasePreview({ climateZone: "temperate", allowExtreme: false });
  assert.equal(preview.timeSegment, "evening");
  await automation.acceptCurrentPhasePreview();
  assert.match(settings.get("calendarDrivenState").resolvedPhaseKey, /:evening$/);

  const queued = await automation.prepareNextPhasePreview();
  assert.equal(queued.segment, "night");
  assert.equal(settings.get("calendarDrivenState").queuedPreview.segment, "night");

  game.time.worldTime = 23 * 3600;
  await automation.processCalendarWorldTimeChange(game.time.worldTime, 2 * 3600);
  const nightState = settings.get("calendarDrivenState");
  assert.match(nightState.currentPhaseKey, /:night$/);
  assert.match(nightState.resolvedPhaseKey, /:evening$/);
  assert.equal(nightState.queuedPreview, null);
  assert.equal(settings.get("weatherPreview").timeSegment, "night");
  assert.equal(settings.get("weatherState").timeSegment, "evening");
});
