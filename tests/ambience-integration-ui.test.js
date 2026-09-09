import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const template = fs.readFileSync(new URL("../templates/weather-forge.hbs", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../scripts/weather-app.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles/pf2e-weather-forge.css", import.meta.url), "utf8");

test("Weather Forge settings expose optional Ambience Forge semantic mapping controls", () => {
  assert.match(template, /name="ambienceIntegrationEnabled"/);
  assert.match(template, /name="ambienceStateGroupKey"/);
  assert.match(template, /name="\{\{fieldName\}\}"/);
  assert.match(template, /weather-forge-ambience-groups/);
  assert.match(template, /weather-forge-ambience-states/);
  assert.match(template, /name="ambienceWindIntegrationEnabled"/);
  assert.match(template, /name="ambienceWindStateGroupKey"/);
  assert.match(template, /weather-forge-ambience-wind-states/);
  assert.match(template, /ambience-wind-mapping-grid/);
  assert.match(app, /ambienceWindMap_/);
});

test("Weather Forge republishes current weather when Ambience Forge becomes ready", () => {
  assert.match(main, /Hooks\.on\("ambienceForgeReady"/);
  assert.match(main, /syncAmbienceFromCurrentWeather\(\{ force: true \}\)/);
});

test("Weather Forge persists user-defined group and state mappings", () => {
  assert.match(app, /game\.settings\.set\(MODULE_ID, "ambienceStateGroupKey"/);
  assert.match(app, /game\.settings\.set\(MODULE_ID, "ambienceWeatherMapping"/);
  assert.match(app, /game\.settings\.set\(MODULE_ID, "ambienceWindStateGroupKey"/);
  assert.match(app, /game\.settings\.set\(MODULE_ID, "ambienceWindMapping"/);
  assert.match(main, /ambienceWindIntegrationEnabled/);
  assert.match(main, /onChange: \(\) => scheduleAmbienceSync\(\)/);
});


test("Weather Forge exposes optional owner-based composition auto-start controls", () => {
  assert.match(template, /name="ambienceAutoStartEnabled"/);
  assert.match(template, /name="ambienceCompositionId"/);
  assert.match(app, /configuredAmbienceCompositionId/);
  assert.match(app, /getAmbienceOwnedCompositionIds/);
  assert.match(main, /ambienceAutoStartEnabled/);
  assert.match(main, /ambienceCompositionId/);
});


test("Settings layout leaves enough room for Ambience Forge controls and stays viewport-safe", () => {
  assert.match(css, /\.pf2e-weather-forge \.settings-tab-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(360px, 1fr\)\)/s);
  assert.match(css, /\.pf2e-weather-forge \.settings-section\s*\{[^}]*min-height:\s*0/s);
  assert.match(css, /\.pf2e-weather-forge \.window-content\s*\{[^}]*overflow:\s*auto[^}]*max-height:\s*calc\(100vh - 90px\)/s);
});
