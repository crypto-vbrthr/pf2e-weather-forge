
import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DAYPART_BOUNDARIES,
  getCalendarForgePhaseInfo
} from "../scripts/calendar-source.js";

function earthContext(worldTime = 0) {
  return {
    worldTime,
    region: null,
    regionId: null,
    calendar: {
      id: "earth-gregorian",
      label: "Gregorian",
      year: 2026,
      monthId: "february",
      monthIndex: 1,
      day: 4,
      weekdayId: "wednesday",
      weekdayIndex: 2,
      names: { month: "February", weekday: "Wednesday" }
    },
    time: { hour: 1, minute: 40, second: 0 },
    season: { id: "winter", label: "Winter" },
    moons: [],
    formatted: { date: "4 February 2026", time: "01:40" },
    raw: {
      calendar: {
        id: "earth-gregorian",
        time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 }
      }
    }
  };
}

test("phase conversion pins to the calendar that produced the context", async () => {
  const settings = new Map([
    ["calendarSourceMode", "calendarForge"],
    ["calendarForgeRegionId", ""],
    ["calendarForgeMoonId", ""],
    ["daypartBoundaries", { ...DEFAULT_DAYPART_BOUNDARIES }]
  ]);

  const toWorldTimeCalls = [];
  const api = {
    getTemporalContext: async ({ worldTime = 0, calendarId = null } = {}) => {
      // Simulate startup race: the first read is Earth. Subsequent explicitly
      // pinned reads remain Earth even if the active/default calendar changes.
      assert.ok(calendarId == null || calendarId === "earth-gregorian");
      return earthContext(worldTime);
    },
    toWorldTime: (date, options = {}) => {
      toWorldTimeCalls.push({ date, options });
      if (options.calendarId !== "earth-gregorian") {
        throw new RangeError(`Unknown month id ${date.monthId}`);
      }
      const hour = Number(date.hour ?? 0);
      return hour * 3600;
    },
    regions: { list: () => [] },
    moonProfiles: { list: () => [] }
  };

  globalThis.game = {
    time: { worldTime: 6000 },
    settings: { get: (_module, key) => settings.get(key) },
    modules: new Map([["pf2e-calendar-forge", { active: true, api }]])
  };

  const phase = await getCalendarForgePhaseInfo(6000);
  assert.equal(phase.context.calendar.id, "earth-gregorian");
  assert.ok(toWorldTimeCalls.length >= 2);
  assert.ok(toWorldTimeCalls.every(call => call.options.calendarId === "earth-gregorian"));
});

test("startup integration is deferred out of the calendarForgeReady hook stack", async () => {
  const source = await (await import("node:fs/promises")).readFile(
    new URL("../scripts/main.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /function scheduleCalendarForgeResume/);
  assert.match(source, /setTimeout\(async \(\) =>/);
  assert.doesNotMatch(
    source,
    /Hooks\.on\("calendarForgeReady", async \(\) => \{[\s\S]*?processCalendarWorldTimeChange/
  );
  assert.match(source, /calendarForgeProviderRegistered/);
  assert.match(source, /calendarForgeProviderDefaultsApplied/);
  assert.match(source, /calendarForgeDefinitionsChanged/);
});
