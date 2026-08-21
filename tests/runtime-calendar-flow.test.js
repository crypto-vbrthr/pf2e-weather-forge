
import test from "node:test";
import assert from "node:assert/strict";
import { defaultWeatherState } from "../scripts/weather-engine.js";
import { DEFAULT_DAYPART_BOUNDARIES } from "../scripts/calendar-source.js";

function buildHarness(startWorldTime = 23 * 3600) {
  const settings = new Map([
    ["calendarSourceMode", "calendarForge"],
    ["calendarForgeRegionId", ""],
    ["calendarForgeMoonId", ""],
    ["daypartAutomationMode", "manual"],
    ["daypartBoundaries", { ...DEFAULT_DAYPART_BOUNDARIES }],
    ["calendarDrivenState", null],
    ["weatherState", { ...defaultWeatherState(), timeSegment: "night", season: "summer" }],
    ["weatherPreview", null],
    ["weatherHistory", []],
    ["historyLimit", "90"],
    ["allowExtreme", false],
    ["extremeFrequency", "normal"],
    ["forecastState", { generatedFrom: null, days: 3, entries: [] }]
  ]);

  const secondsPerDay = 86400;
  const makeContext = worldTime => {
    const dayIndex = Math.floor(worldTime / secondsPerDay);
    const inDay = ((worldTime % secondsPerDay) + secondsPerDay) % secondsPerDay;
    const hour = Math.floor(inDay / 3600);
    const minute = Math.floor((inDay % 3600) / 60);
    const day = dayIndex + 1;
    const moonPhase = day >= 2 ? "new" : "waning-crescent";
    return {
      worldTime,
      region: null,
      regionId: null,
      calendar: {
        id: "test-calendar", label: "Test", year: 1, monthId: "m1",
        monthIndex: 0, day, weekdayId: "starday", weekdayIndex: 5,
        names: { month: "Month", weekday: "Starday" }
      },
      time: { hour, minute, second: 0 },
      season: { id: day >= 2 ? "autumn" : "summer", label: day >= 2 ? "Autumn" : "Summer" },
      moons: [{ id: "moon", phase: moonPhase, phaseLabel: moonPhase, progress: day >= 2 ? 0 : 0.9 }],
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
  globalThis.ui = { notifications: { info: () => {}, warn: () => {}, error: () => {} } };
  globalThis.game = {
    time: { worldTime: startWorldTime },
    user: { isGM: true },
    modules: new Map([["pf2e-calendar-forge", { active: true, api }]]),
    i18n: { localize: key => key, format: (key, data) => `${key}:${data?.daypart ?? ""}` },
    settings: {
      get: (_module, key) => settings.get(key),
      set: async (_module, key, value) => { settings.set(key, structuredClone(value)); return value; }
    }
  };
  return { settings };
}

test("crossing midnight inside night refreshes date season and moon metadata without generating a phase", async () => {
  const { settings } = buildHarness();
  const automation = await import("../scripts/daypart-automation.js");
  await automation.initializeCalendarDrivenWeather({ force: true });

  game.time.worldTime = 25 * 3600;
  const result = await automation.processCalendarWorldTimeChange(game.time.worldTime, 2 * 3600);

  assert.equal(result.boundaries, 0);
  const weather = settings.get("weatherState");
  assert.equal(weather.dayOfMonth, 2);
  assert.equal(weather.season, "autumn");
  assert.equal(weather.moonPhase, "newMoon");
  assert.equal(weather.timeSegment, "night");
  assert.equal(settings.get("weatherHistory").length, 0);
});

test("prepared next-daypart preview becomes stale if meteorological base changes before boundary", async () => {
  const { settings } = buildHarness(6 * 3600);
  const automation = await import("../scripts/daypart-automation.js");
  await automation.initializeCalendarDrivenWeather({ force: true });
  await automation.prepareNextPhasePreview();

  settings.set("weatherState", { ...settings.get("weatherState"), humidity: 99 });

  game.time.worldTime = 12 * 3600;
  await automation.processCalendarWorldTimeChange(game.time.worldTime, 6 * 3600);

  const state = settings.get("calendarDrivenState");
  assert.equal(state.queuedPreview, null);
  assert.equal(settings.get("weatherPreview"), null);
  assert.match(state.currentPhaseKey, /:noon$/);
});
