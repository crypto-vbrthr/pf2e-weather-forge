import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const template = fs.readFileSync(new URL("../templates/weather-forge.hbs", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../scripts/weather-app.js", import.meta.url), "utf8");

test("Weather Forge settings expose optional Ambience Forge semantic mapping controls", () => {
  assert.match(template, /name="ambienceIntegrationEnabled"/);
  assert.match(template, /name="ambienceStateGroupKey"/);
  assert.match(template, /name="\{\{fieldName\}\}"/);
  assert.match(template, /weather-forge-ambience-groups/);
  assert.match(template, /weather-forge-ambience-states/);
});

test("Weather Forge republishes current weather when Ambience Forge becomes ready", () => {
  assert.match(main, /Hooks\.on\("ambienceForgeReady"/);
  assert.match(main, /syncAmbienceFromCurrentWeather\(\{ force: true \}\)/);
});

test("Weather Forge persists user-defined group and state mappings", () => {
  assert.match(app, /game\.settings\.set\(MODULE_ID, "ambienceStateGroupKey"/);
  assert.match(app, /game\.settings\.set\(MODULE_ID, "ambienceWeatherMapping"/);
  assert.match(main, /onChange: \(\) => scheduleAmbienceSync\(\)/);
});
