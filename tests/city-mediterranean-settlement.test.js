import test from "node:test";
import assert from "node:assert/strict";

import { resolveEffectiveClimateContext } from "../scripts/city-source.js";

test("explicit City Forge Mediterranean settlement overrides temperate manual fallback", async () => {
  const settings = new Map([
    ["climateSourceMode", "settlement"],
    ["cityForgeSettlementId", "schusseln"],
    ["manualClimateZone", "temperate"],
    ["cityForgeIntegrationState", { version: 2 }]
  ]);

  const cityApi = {
    settlements: {
      async list() {
        return [{
          id: "schusseln",
          definition: {
            identity: { name: "Schusseln", level: 5, type: "town" },
            geography: {
              region: "Varisia, Südküste",
              terrain: "coastal",
              climate: "mediterranean"
            }
          }
        }];
      }
    },
    integrations: {
      async getContextForScene() {
        return null;
      },
      weather: {
        async getContext(id) {
          assert.equal(id, "schusseln");
          return {
            settlement: { id: "schusseln", name: "Schusseln", revision: 9 },
            geography: {
              region: "Varisia, Südküste",
              terrain: "coastal",
              climate: "mediterranean"
            },
            scope: {
              sceneUuid: null,
              district: null,
              location: null
            }
          };
        }
      }
    }
  };

  globalThis.canvas = { scene: { uuid: "Scene.unlinked" } };
  globalThis.game = {
    user: { viewedScene: "unlinked" },
    scenes: {
      current: { uuid: "Scene.unlinked" },
      get: () => ({ uuid: "Scene.unlinked" })
    },
    modules: new Map([
      ["pf2e-city-forge", { active: true, version: "0.8.2", api: cityApi }]
    ]),
    settings: {
      get: (_module, key) => settings.get(key),
      set: async (_module, key, value) => {
        settings.set(key, structuredClone(value));
        return value;
      }
    }
  };

  const resolution = await resolveEffectiveClimateContext();

  assert.equal(resolution.sourceMode, "settlement");
  assert.equal(resolution.source, "cityForge");
  assert.equal(resolution.context.settlement.id, "schusseln");
  assert.equal(resolution.mappingField, "climate");
  assert.equal(resolution.mappingValue, "mediterranean");
  assert.equal(resolution.effectiveClimateZone, "mediterranean");
  assert.notEqual(resolution.effectiveClimateZone, "temperate");
});
