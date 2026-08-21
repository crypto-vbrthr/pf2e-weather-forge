import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_DAYPART_BOUNDARIES } from "../scripts/calendar-source.js";
import { defaultCalendarDrivenState } from "../scripts/daypart-automation.js";
import { defaultWeatherState } from "../scripts/weather-engine.js";

test("queued Calendar Forge daypart preview uses the active City Forge Scene climate", async () => {
  const settings = new Map([
    ["calendarSourceMode", "calendarForge"],
    ["calendarForgeRegionId", ""],
    ["calendarForgeMoonId", ""],
    ["daypartAutomationMode", "manual"],
    ["daypartBoundaries", { ...DEFAULT_DAYPART_BOUNDARIES }],
    ["calendarDrivenState", defaultCalendarDrivenState()],
    ["weatherState", { ...defaultWeatherState(), timeSegment: "morning", season: "summer" }],
    ["weatherPreview", null],
    ["weatherHistory", []],
    ["historyLimit", "90"],
    ["allowExtreme", false],
    ["extremeFrequency", "normal"],
    ["forecastState", { generatedFrom: null, days: 3, entries: [] }],
    ["climateSourceMode", "scene"],
    ["cityForgeSettlementId", ""],
    ["manualClimateZone", "temperate"]
  ]);

  const makeContext = (worldTime) => ({
    worldTime,
    region: null,
    regionId: null,
    calendar: {
      id: "test-calendar",
      label: "Test",
      year: 1,
      monthId: "m1",
      monthIndex: 0,
      day: 1,
      weekdayId: "moonday",
      weekdayIndex: 0,
      names: { month: "Month", weekday: "Moonday" }
    },
    time: { hour: Math.floor(worldTime / 3600), minute: 0, second: 0 },
    season: { id: "summer", label: "Summer" },
    moons: [{ id: "moon", phase: "full", phaseLabel: "Full", progress: 0.5 }],
    formatted: { date: "1. Month 1", time: "06:00" },
    raw: { calendar: { id: "test-calendar", time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 } } }
  });

  const calendarApi = {
    getTemporalContext: async ({ worldTime = globalThis.game.time.worldTime } = {}) => makeContext(worldTime),
    toWorldTime: ({ hour = 0, minute = 0, second = 0 }) => hour * 3600 + minute * 60 + second,
    regions: { list: () => [] },
    moonProfiles: { list: () => [] }
  };

  const cityApi = {
    integrations: {
      getContextForScene: async (sceneUuid, consumer) => {
        assert.equal(sceneUuid, "Scene.desert-town");
        assert.equal(consumer, "weather");
        return {
          settlement: { id: "desert-town", name: "Dustfall", revision: 3 },
          geography: { region: "Katapesh", terrain: "Wüste", climate: "Desert" },
          scope: {
            sceneUuid,
            district: { id: "bazaar", name: "Bazaar" },
            location: null
          }
        };
      }
    }
  };

  globalThis.foundry = { utils: { randomID: () => "test-id" } };
  globalThis.ui = { notifications: { info: () => {}, warn: () => {}, error: () => {} } };
  globalThis.canvas = { scene: { uuid: "Scene.desert-town" } };
  globalThis.game = {
    time: { worldTime: 6 * 3600 },
    user: { isGM: true, viewedScene: "desert-town" },
    scenes: { current: { uuid: "Scene.desert-town" }, get: () => ({ uuid: "Scene.desert-town" }) },
    modules: new Map([
      ["pf2e-calendar-forge", { active: true, api: calendarApi }],
      ["pf2e-city-forge", { active: true, version: "0.8.1", api: cityApi }]
    ]),
    i18n: { localize: key => key, format: key => key },
    settings: {
      get: (_module, key) => settings.get(key),
      set: async (_module, key, value) => {
        settings.set(key, structuredClone(value));
        return value;
      }
    }
  };

  const automation = await import("../scripts/daypart-automation.js");
  await automation.initializeCalendarDrivenWeather({ force: true });
  const queued = await automation.prepareNextPhasePreview();

  assert.equal(queued.weather.climateZone, "desert");
  assert.equal(queued.weather.weatherForgeClimateSource, "cityForge");
  assert.equal(queued.weather.weatherForgeCityContext.settlementId, "desert-town");
  assert.equal(queued.weather.weatherForgeCityContext.districtId, "bazaar");
});
