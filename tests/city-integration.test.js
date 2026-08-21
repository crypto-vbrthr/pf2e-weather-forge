import test from "node:test";
import assert from "node:assert/strict";

import {
  annotateWeatherWithClimateContext,
  cityForgeRuntimeStatus,
  mapCityContextToClimate,
  resolveEffectiveClimateContext,
  weatherContextMismatch
} from "../scripts/city-source.js";
import { defaultWeatherState } from "../scripts/weather-engine.js";

function cityContext({
  climate = "Gemäßigt",
  terrain = "Wald",
  sceneUuid = "Scene.ostwall",
  settlementId = "ostwall",
  districtId = "market",
  locationId = "inn"
} = {}) {
  return {
    settlement: {
      id: settlementId,
      name: "Ostwall",
      revision: 12
    },
    geography: {
      region: "Varisia",
      terrain,
      climate
    },
    scope: {
      sceneUuid,
      district: districtId ? { id: districtId, name: "Marktviertel" } : null,
      location: locationId ? { id: locationId, name: "Zum Hirsch", districtId } : null
    }
  };
}

function setGame({
  mode = "scene",
  manual = "temperate",
  context = cityContext(),
  cityActive = true
} = {}) {
  const settings = new Map([
    ["climateSourceMode", mode],
    ["manualClimateZone", manual],
    ["cityForgeSettlementId", ""]
  ]);

  const cityApi = {
    integrations: {
      getContextForScene: async (sceneUuid, consumer) => {
        assert.equal(consumer, "weather");
        return sceneUuid === context?.scope?.sceneUuid ? context : null;
      }
    }
  };

  globalThis.game = {
    user: { viewedScene: "ostwall" },
    scenes: {
      current: { uuid: context?.scope?.sceneUuid ?? "Scene.ostwall" },
      get: () => ({ uuid: context?.scope?.sceneUuid ?? "Scene.ostwall" })
    },
    settings: {
      get: (_module, key) => settings.get(key),
      set: async (_module, key, value) => {
        settings.set(key, structuredClone(value));
        return value;
      }
    },
    modules: new Map([
      ["pf2e-city-forge", {
        active: cityActive,
        version: "0.8.1",
        api: cityActive ? cityApi : null
      }]
    ])
  };
  globalThis.canvas = { scene: { uuid: context?.scope?.sceneUuid ?? "Scene.ostwall" } };
  return { settings };
}

test("German and English City climate strings map to Weather Forge climate zones", () => {
  assert.deepEqual(mapCityContextToClimate(cityContext({ climate: "Gemäßigt" })), {
    climateZone: "temperate",
    field: "climate",
    value: "Gemäßigt"
  });
  assert.equal(mapCityContextToClimate(cityContext({ climate: "Mediterranean" })).climateZone, "mediterranean");
  assert.equal(mapCityContextToClimate(cityContext({ climate: "Tropisch" })).climateZone, "tropical");
  assert.equal(mapCityContextToClimate(cityContext({ climate: "Arktisch" })).climateZone, "arctic");
});

test("terrain is a safe fallback only when City climate text is not mapped", () => {
  const mapped = mapCityContextToClimate(cityContext({
    climate: "Feucht und windig",
    terrain: "Küste"
  }));
  assert.equal(mapped.climateZone, "coastal");
  assert.equal(mapped.field, "terrain");
});

test("automatic mode resolves the active Scene through City Forge and uses its climate", async () => {
  setGame();
  const result = await resolveEffectiveClimateContext();
  assert.equal(result.source, "cityForge");
  assert.equal(result.effectiveClimateZone, "temperate");
  assert.equal(result.context.settlement.id, "ostwall");
  assert.equal(result.context.scope.location.id, "inn");
  assert.equal(cityForgeRuntimeStatus().compatible, true);
});

test("unmapped City climate falls back to the configured manual climate without guessing", async () => {
  setGame({
    manual: "mountain",
    context: cityContext({
      climate: "Ständig wechselndes seltsames Wetter",
      terrain: "Hügel"
    })
  });
  const result = await resolveEffectiveClimateContext();
  assert.equal(result.source, "manual");
  assert.equal(result.reason, "city-climate-unmapped");
  assert.equal(result.effectiveClimateZone, "mountain");
  assert.equal(result.context.settlement.id, "ostwall");
});

test("manual mode never consumes City Forge climate", async () => {
  setGame({ mode: "manual", manual: "desert" });
  const result = await resolveEffectiveClimateContext();
  assert.equal(result.source, "manual");
  assert.equal(result.reason, "manual-mode");
  assert.equal(result.effectiveClimateZone, "desert");
  assert.equal(result.context, null);
});

test("weather provenance records the exact settlement / district / location used for generation", async () => {
  setGame();
  const result = await resolveEffectiveClimateContext();
  const weather = annotateWeatherWithClimateContext(
    { ...defaultWeatherState(), climateZone: result.effectiveClimateZone },
    result
  );

  assert.equal(weather.weatherForgeClimateSource, "cityForge");
  assert.equal(weather.weatherForgeCityContext.settlementId, "ostwall");
  assert.equal(weather.weatherForgeCityContext.districtId, "market");
  assert.equal(weather.weatherForgeCityContext.locationId, "inn");
  assert.equal(weather.weatherForgeCityContext.resolvedClimateZone, "temperate");
});

test("current weather mismatch detects an active-scene place change without silently rewriting weather", async () => {
  setGame();
  const first = await resolveEffectiveClimateContext();
  const weather = annotateWeatherWithClimateContext(defaultWeatherState(), first);

  const secondContext = cityContext({
    sceneUuid: "Scene.docks",
    districtId: "docks",
    locationId: "pier"
  });
  setGame({ context: secondContext });
  const second = await resolveEffectiveClimateContext();

  assert.equal(weatherContextMismatch(weather, second), true);
  assert.equal(weather.weatherForgeCityContext.locationId, "inn");
});
