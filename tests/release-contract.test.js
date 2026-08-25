import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  calendarForgeOptions,
  effectiveCalendarSourceMode,
  calendarForgeRuntimeStatus
} from "../scripts/calendar-source.js";

const moduleJson = JSON.parse(fs.readFileSync(new URL("../module.json", import.meta.url), "utf8"));
const de = JSON.parse(fs.readFileSync(new URL("../lang/de.json", import.meta.url), "utf8"));
const en = JSON.parse(fs.readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));
const template = fs.readFileSync(new URL("../templates/weather-forge.hbs", import.meta.url), "utf8");
const appJs = fs.readFileSync(new URL("../scripts/weather-app.js", import.meta.url), "utf8");

function setGame({ settings = new Map(), calendarModule = null } = {}) {
  globalThis.game = {
    settings: { get: (_module, key) => settings.get(key) },
    modules: new Map(calendarModule ? [["pf2e-calendar-forge", calendarModule]] : [])
  };
}

test("release manifest contains production metadata and no hard Calendar Forge requirement", () => {
  assert.equal(moduleJson.version, "1.1.3.1");
  assert.equal(moduleJson.compatibility.verified, "14");
  assert.equal(moduleJson.authors?.[0]?.name, "crypto-vbrthr");
  assert.ok(!JSON.stringify(moduleJson).includes("Your Name"));
  assert.deepEqual(moduleJson.relationships?.requires ?? [], []);
});

test("German and English localization contracts are identical", () => {
  assert.deepEqual([...Object.keys(de)].sort(), [...Object.keys(en)].sort());
});

test("all template actions have application handlers", () => {
  const actions = [...template.matchAll(/data-action="([^"]+)"/g)].map(match => match[1]);
  for (const action of new Set(actions)) assert.ok(appJs.includes(action), `Missing handler for ${action}`);
});

test("auto mode falls back to internal calendar when Calendar Forge is absent", () => {
  setGame({ settings: new Map([["calendarSourceMode", "auto"]]) });
  assert.equal(effectiveCalendarSourceMode(), "internal");
  assert.deepEqual(calendarForgeRuntimeStatus(), {
    configured: "auto", available: false, effective: "internal", fallback: true
  });
});

test("an available but empty provider registry clears stale region and moon selections", () => {
  const settings = new Map([
    ["calendarSourceMode", "calendarForge"],
    ["calendarForgeRegionId", "gone-region"],
    ["calendarForgeMoonId", "gone-moon"]
  ]);
  setGame({
    settings,
    calendarModule: {
      active: true,
      api: {
        getTemporalContext: async () => ({}),
        toWorldTime: async () => 0,
        regions: { list: () => [] },
        moonProfiles: { list: () => [] }
      }
    }
  });
  assert.deepEqual(calendarForgeOptions({ worldTime: 123 }), { worldTime: 123 });
});
