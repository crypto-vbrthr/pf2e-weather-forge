
import test from "node:test";
import assert from "node:assert/strict";

import {
  weatherFingerprint,
  phaseContextSignature,
  queuedPreviewIsValid,
  defaultCalendarDrivenState
} from "../scripts/daypart-automation.js";
import { defaultWeatherState } from "../scripts/weather-engine.js";
import { canAdoptWeatherIntoInternalCalendar } from "../scripts/calendar-engine.js";
import { calendarForgeOptions } from "../scripts/calendar-source.js";

test("prepared next-daypart previews are tied to the weather state they were generated from", () => {
  const base = { ...defaultWeatherState(), temperature: 18, humidity: 60 };
  const changed = { ...base, humidity: 84 };
  const phase = {
    key: "50400:afternoon", segment: "afternoon",
    calendar: {
      year: 4726, month: "erastus", dayOfMonth: 4, weekday: "starday",
      season: "summer", moonId: "somal", moonPhase: "waningCrescent",
      calendarId: "golarion-ar", regionId: "inner-sea"
    }
  };
  const signature = "auto|inner-sea|somal|{}";
  const queued = {
    phaseKey: phase.key,
    weather: { ...base },
    baseFingerprint: weatherFingerprint(base),
    targetContextSignature: phaseContextSignature(phase),
    sourceSignature: signature
  };
  assert.equal(queuedPreviewIsValid(queued, base, phase, signature), true);
  assert.equal(queuedPreviewIsValid(queued, changed, phase, signature), false);
});

test("phase context signature changes when date, season, or moon context changes inside a daypart", () => {
  const a = {
    key: "79200:night", segment: "night",
    calendar: {
      year: 4726, month: "erastus", dayOfMonth: 4, weekday: "starday",
      season: "summer", moonId: "somal", moonPhase: "waningCrescent",
      calendarId: "golarion-ar", regionId: "inner-sea"
    }
  };
  const b = structuredClone(a);
  b.calendar.dayOfMonth = 5;
  const c = structuredClone(a);
  c.calendar.moonPhase = "newMoon";
  assert.notEqual(phaseContextSignature(a), phaseContextSignature(b));
  assert.notEqual(phaseContextSignature(a), phaseContextSignature(c));
});

test("weather fingerprint ignores calendar labels and time metadata", () => {
  const a = { ...defaultWeatherState(), temperature: 12, formattedDate: "4. Erastus", timeSegment: "night" };
  const b = { ...a, formattedDate: "5. Erastus", timeSegment: "morning", moonPhase: "fullMoon" };
  assert.equal(weatherFingerprint(a), weatherFingerprint(b));
});

test("internal fallback adopts compatible Golarion weather but refuses exotic calendar ids", () => {
  const compatible = { ...defaultWeatherState(), month: "erastus", weekday: "starday", timeSegment: "night", year: 4726, dayOfMonth: 4 };
  const exotic = { ...compatible, month: "thirteenth-moon" };
  assert.equal(canAdoptWeatherIntoInternalCalendar(compatible), true);
  assert.equal(canAdoptWeatherIntoInternalCalendar(exotic), false);
});

test("runtime state schema includes catch-up bookkeeping", () => {
  const state = defaultCalendarDrivenState();
  assert.equal(state.stateVersion, 2);
  assert.equal(state.lastCatchupCount, 0);
});

test("stale provider region and moon ids are ignored safely", () => {
  const settings = new Map([
    ["calendarForgeRegionId", "removed-region"],
    ["calendarForgeMoonId", "removed-moon"]
  ]);
  globalThis.game = {
    settings: { get: (_m, key) => settings.get(key) },
    modules: new Map([["pf2e-calendar-forge", {
      active: true,
      api: {
        getTemporalContext: async () => ({}),
        toWorldTime: async () => 0,
        regions: { list: () => [{ id: "valid-region" }] },
        moonProfiles: { list: () => [{ id: "valid-moon" }] }
      }
    }]])
  };
  assert.deepEqual(calendarForgeOptions({ worldTime: 42 }), { worldTime: 42 });
});
