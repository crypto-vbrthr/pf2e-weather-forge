import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../scripts/weather-app.js", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
const template = fs.readFileSync(new URL("../templates/weather-forge.hbs", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles/pf2e-weather-forge.css", import.meta.url), "utf8");

test("Weather Forge exposes City climate source and active-context UI", () => {
  assert.match(template, /name="climateSourceMode"/);
  assert.match(template, /cityIntegration\.contextLabel/);
  assert.match(template, /cityIntegration\.effectiveClimateLabel/);
  assert.match(template, /cityIntegration\.currentMismatch/);
  assert.match(app, /resolveEffectiveClimateContext/);
});

test("scene and City settlement changes invalidate stale previews instead of changing accepted weather", () => {
  assert.match(main, /Hooks\.on\("canvasReady"/);
  assert.match(main, /pf2eCityForge\.settlementUpdated/);
  assert.match(main, /weatherPreview", null/);
  assert.match(main, /invalidateQueuedPreview/);
  assert.doesNotMatch(main, /canvasReady[\s\S]{0,500}weatherState"/);
});

test("Weather Forge public API exposes current City climate and weather provenance", () => {
  assert.match(main, /cityForgeClimate:\s*true/);
  assert.match(main, /activeSceneClimate:\s*true/);
  assert.match(main, /getCityForgeStatus/);
  assert.match(main, /getClimateContext/);
  assert.match(main, /getCurrentWeatherContext/);
});

test("Weather Forge CSS is isolated beneath its own application root", () => {
  assert.match(css, /\.pf2e-weather-forge \.weather-tabs/);
  assert.match(css, /\.pf2e-weather-forge \.city-weather-context/);
  assert.doesNotMatch(css, /^\.weather-tabs\s*\{/m);
  assert.doesNotMatch(css, /^\.weather-panel\s*\{/m);
});


test("Weather Forge settings expose explicit City Forge settlement selection", () => {
  assert.match(template, /name="cityForgeSettlementId"/);
  assert.match(template, /appSettings\.cityForgeSettlements/);
  assert.match(app, /listCityForgeSettlements/);
  assert.match(app, /configuredCityForgeSettlementId/);
});

test("climate source supports Scene, settlement and manual modes", () => {
  assert.match(app, /CLIMATE_SOURCE_MODES/);
  assert.match(main, /source\.scene/);
  assert.match(main, /source\.settlement/);
});
