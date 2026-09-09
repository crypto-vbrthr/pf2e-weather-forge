import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_AMBIENCE_WEATHER_MAPPING,
  aggregateAmbienceStateGroups,
  normalizeAmbienceWeatherMapping,
  resolveAmbienceWeatherKind
} from "../scripts/ambience-source.js";

test("weather resolves to semantic Ambience Forge states", () => {
  assert.equal(resolveAmbienceWeatherKind({ precipitation: "none", cloudDensity: 20 }), "clear");
  assert.equal(resolveAmbienceWeatherKind({ precipitation: "none", cloudDensity: 80 }), "cloudy");
  assert.equal(resolveAmbienceWeatherKind({ precipitation: "drizzle", cloudDensity: 50 }), "rain");
  assert.equal(resolveAmbienceWeatherKind({ precipitation: "lightRain" }), "rain");
  assert.equal(resolveAmbienceWeatherKind({ precipitation: "rain" }), "rain");
  assert.equal(resolveAmbienceWeatherKind({ precipitation: "heavyRain" }), "heavy-rain");
  assert.equal(resolveAmbienceWeatherKind({ precipitation: "thunderstorm" }), "storm");
  assert.equal(resolveAmbienceWeatherKind({ precipitation: "snow" }), "snow");
  assert.equal(resolveAmbienceWeatherKind({ precipitation: "mist" }), "fog");
});

test("extreme weather takes precedence over ordinary precipitation", () => {
  assert.equal(resolveAmbienceWeatherKind({ precipitation: "rain", extremeWeather: { type: "storm" } }), "storm");
  assert.equal(resolveAmbienceWeatherKind({ precipitation: "snow", extremeWeather: { type: "blizzard" } }), "blizzard");
  assert.equal(resolveAmbienceWeatherKind({ precipitation: "none", extremeWeather: { type: "fog" } }), "fog");
});

test("mapping uses Forge Suite standard keys by default and preserves custom keys", () => {
  const defaults = normalizeAmbienceWeatherMapping();
  assert.equal(defaults.storm, "storm");
  assert.equal(defaults.blizzard, "heavy-snow");
  assert.deepEqual(defaults, DEFAULT_AMBIENCE_WEATHER_MAPPING);

  const custom = normalizeAmbienceWeatherMapping({ storm: "violent-storm", rain: "wet" });
  assert.equal(custom.storm, "violent-storm");
  assert.equal(custom.rain, "wet");
  assert.equal(custom.clear, "clear");
});

test("state discovery aggregates groups and states across compositions", () => {
  const groups = aggregateAmbienceStateGroups({
    compositions: [
      { key: "forest", groups: [{ key: "weather", name: "Wetter", states: [{ key: "rain", name: "Regen" }, { key: "storm", name: "Sturm" }] }] },
      { key: "tavern", groups: [{ key: "weather", name: "Weather", states: [{ key: "rain", name: "Rain" }] }, { key: "situation", name: "Situation", states: [{ key: "busy", name: "Busy" }] }] }
    ]
  });

  assert.equal(groups.length, 2);
  const weather = groups.find(group => group.key === "weather");
  assert.equal(weather.compositionCount, 2);
  assert.deepEqual(weather.states.map(state => state.key), ["rain", "storm"]);
  assert.equal(weather.states.find(state => state.key === "rain").compositionCount, 2);
});

import {
  AMBIENCE_OWNER_ID,
  resetAmbienceSyncSignature,
  syncAmbienceFromWeather
} from "../scripts/ambience-source.js";

function installAmbienceRuntime({ enabled = true, group = "weather", mapping = DEFAULT_AMBIENCE_WEATHER_MAPPING } = {}) {
  const calls = [];
  const settings = new Map([
    ["ambienceIntegrationEnabled", enabled],
    ["ambienceStateGroupKey", group],
    ["ambienceWeatherMapping", mapping]
  ]);
  const api = {
    version: "1.3",
    capabilities: ["context-states-v1", "state-discovery-v1"],
    async setContextState(payload) { calls.push(["set", payload]); return []; },
    async clearContextState(payload) { calls.push(["clear", payload]); return []; },
    getStateCatalog() { return { compositions: [] }; }
  };
  globalThis.game = {
    user: { id: "gm", isGM: true },
    users: { activeGM: { id: "gm" }, [Symbol.iterator]: function* () { yield { id: "gm", active: true, isGM: true }; } },
    modules: new Map([["ambience-forge", { active: true, api }]]),
    settings: { get: (_module, key) => settings.get(key) }
  };
  return { calls, settings, api };
}

test("Weather Forge publishes persistent semantic weather context with its module id as owner", async () => {
  resetAmbienceSyncSignature();
  const { calls } = installAmbienceRuntime();
  const result = await syncAmbienceFromWeather({ precipitation: "thunderstorm" }, { force: true });
  assert.equal(result, true);
  assert.deepEqual(calls, [["set", { group: "weather", state: "storm", owner: AMBIENCE_OWNER_ID }]]);
});

test("custom user mappings are used when publishing Ambience Forge context", async () => {
  resetAmbienceSyncSignature();
  const { calls } = installAmbienceRuntime({ mapping: { ...DEFAULT_AMBIENCE_WEATHER_MAPPING, storm: "violent-storm" } });
  await syncAmbienceFromWeather({ precipitation: "heavyRain", extremeWeather: { type: "storm" } }, { force: true });
  assert.equal(calls[0][1].state, "violent-storm");
});

test("disabling the integration clears Weather Forge-owned context", async () => {
  resetAmbienceSyncSignature();
  const { calls } = installAmbienceRuntime({ enabled: false });
  await syncAmbienceFromWeather({ precipitation: "rain" }, { force: true });
  assert.deepEqual(calls, [["clear", { group: "weather", owner: AMBIENCE_OWNER_ID }]]);
});

test("ownership conflicts reported by Ambience Forge are not treated as successful synchronization", async () => {
  resetAmbienceSyncSignature();
  const { api } = installAmbienceRuntime();
  api.setContextState = async () => false;
  const result = await syncAmbienceFromWeather({ precipitation: "rain" }, { force: true });
  assert.equal(result, false);
});
