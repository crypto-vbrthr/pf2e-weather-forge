import test from "node:test";
import assert from "node:assert/strict";

import {
  configuredClimateSourceMode,
  initializeCityForgeClimateSettings,
  listCityForgeSettlements,
  mapCityContextToClimate,
  resolveEffectiveClimateContext
} from "../scripts/city-source.js";

function makeCityApi() {
  const settlements = [
    {
      id: "ostwall",
      definition: {
        identity: { name: "Ostwall", level: 4, type: "village" },
        geography: { region: "Varisia", terrain: "forest", climate: "temperate" }
      }
    },
    {
      id: "dustfall",
      definition: {
        identity: { name: "Dustfall", level: 6, type: "town" },
        geography: { region: "Katapesh", terrain: "desert", climate: "desert" }
      }
    }
  ];

  return {
    settlements: {
      async list() {
        return structuredClone(settlements);
      }
    },
    integrations: {
      async getContextForScene() {
        return {
          settlement: { id: "ostwall", name: "Ostwall", revision: 1 },
          geography: { region: "Varisia", terrain: "forest", climate: "temperate" },
          scope: { sceneUuid: "Scene.ostwall", district: null, location: null }
        };
      },
      weather: {
        async getContext(id) {
          if (id === "dustfall") {
            return {
              settlement: { id: "dustfall", name: "Dustfall", revision: 4 },
              geography: { region: "Katapesh", terrain: "desert", climate: "desert" },
              scope: { sceneUuid: null, district: null, location: null }
            };
          }
          if (id === "ostwall") {
            return {
              settlement: { id: "ostwall", name: "Ostwall", revision: 2 },
              geography: { region: "Varisia", terrain: "forest", climate: "temperate" },
              scope: { sceneUuid: null, district: null, location: null }
            };
          }
          return null;
        }
      }
    }
  };
}

function setup({ mode = "settlement", settlementId = "dustfall", climate = "temperate" } = {}) {
  const settings = new Map([
    ["climateSourceMode", mode],
    ["cityForgeSettlementId", settlementId],
    ["manualClimateZone", climate],
    ["cityForgeIntegrationState", { version: 2 }]
  ]);

  globalThis.canvas = { scene: { uuid: "Scene.ostwall" } };
  globalThis.game = {
    user: { viewedScene: "ostwall" },
    scenes: { current: { uuid: "Scene.ostwall" }, get: () => ({ uuid: "Scene.ostwall" }) },
    modules: new Map([
      ["pf2e-city-forge", { active: true, version: "0.8.2", api: makeCityApi() }]
    ]),
    settings: {
      get: (_module, key) => settings.get(key),
      set: async (_module, key, value) => {
        settings.set(key, structuredClone(value));
        return value;
      }
    }
  };

  return settings;
}

test("explicit settlement mode ignores the active Scene and uses the selected City Forge settlement", async () => {
  setup({ mode: "settlement", settlementId: "dustfall" });
  const result = await resolveEffectiveClimateContext();

  assert.equal(result.sourceMode, "settlement");
  assert.equal(result.source, "cityForge");
  assert.equal(result.context.settlement.id, "dustfall");
  assert.equal(result.effectiveClimateZone, "desert");
  assert.equal(result.context.scope.location, null);
});

test("settlement list is populated from City Forge public settlement API", async () => {
  setup();
  const rows = await listCityForgeSettlements();
  assert.deepEqual(rows.map((row) => row.id), ["dustfall", "ostwall"]);
  assert.equal(rows[0].climate, "desert");
  assert.equal(rows[1].region, "Varisia");
});

test("explicit settlement mode falls back safely when no settlement is selected", async () => {
  setup({ settlementId: "", climate: "mountain" });
  const result = await resolveEffectiveClimateContext();

  assert.equal(result.source, "manual");
  assert.equal(result.reason, "settlement-unselected");
  assert.equal(result.effectiveClimateZone, "mountain");
});

test("canonical City Forge 0.8.2 climate ids are accepted directly", () => {
  const mapping = mapCityContextToClimate({
    geography: { climate: "coastal", terrain: "desert" }
  });

  assert.deepEqual(mapping, {
    climateZone: "coastal",
    field: "climate",
    value: "coastal"
  });
});

test("legacy Weather Forge 1.1.0 auto mode migrates to scene mode", async () => {
  const settings = setup({ mode: "auto" });
  settings.set("cityForgeIntegrationState", { version: 1 });

  const result = await initializeCityForgeClimateSettings();

  assert.equal(result.version, 2);
  assert.equal(settings.get("climateSourceMode"), "scene");
  assert.equal(configuredClimateSourceMode(), "scene");
});
