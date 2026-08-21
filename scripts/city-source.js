import { CLIMATE_ZONES, MODULE_ID } from "./weather-engine.js";

export const CITY_FORGE_MODULE_ID = "pf2e-city-forge";
export const CLIMATE_SOURCE_MODES = Object.freeze(["scene", "settlement", "manual"]);

const LEGACY_MODE_MAP = Object.freeze({
  auto: "scene",
  scene: "scene",
  settlement: "settlement",
  manual: "manual"
});

const CLIMATE_ALIASES = Object.freeze({
  temperate: Object.freeze([
    "temperate", "temperiert", "gemassigt", "gemaessigt", "mild", "moderate climate"
  ]),
  mediterranean: Object.freeze([
    "mediterranean", "mediterran", "mediterranes klima", "mediterranean climate"
  ]),
  coastal: Object.freeze([
    "coastal", "coast", "coastline", "maritime", "maritim", "kuste", "kueste",
    "kustenklima", "kuestenklima", "seaside"
  ]),
  arctic: Object.freeze([
    "arctic", "arktisch", "polar", "subarctic", "subarktisch", "tundra"
  ]),
  desert: Object.freeze([
    "desert", "wuste", "wueste", "arid", "arid climate", "trockenwuste", "trocken"
  ]),
  tropical: Object.freeze([
    "tropical", "tropisch", "rainforest", "regenwald", "humid tropical", "feuchttropisch"
  ]),
  mountain: Object.freeze([
    "mountain", "mountains", "mountainous", "gebirge", "bergland", "alpine", "alpin",
    "highlands", "hochgebirge"
  ]),
  swamp: Object.freeze([
    "swamp", "swampy", "marsh", "marshland", "wetland", "sumpf", "moor", "feuchtgebiet"
  ]),
  magical: Object.freeze([
    "magical", "magic", "magisch", "unnatural", "unwirklich", "planar", "anomalous"
  ])
});

const TERRAIN_ALIASES = Object.freeze({
  coastal: Object.freeze(["coast", "coastal", "shore", "seashore", "kuste", "kueste", "strand"]),
  arctic: Object.freeze(["tundra", "ice", "eis", "polar", "glacier", "gletscher"]),
  desert: Object.freeze(["desert", "wuste", "wueste", "dunes", "dune"]),
  tropical: Object.freeze(["rainforest", "regenwald", "jungle", "dschungel"]),
  mountain: Object.freeze(["mountain", "mountains", "gebirge", "alpine", "alpin", "highlands"]),
  swamp: Object.freeze(["swamp", "marsh", "wetland", "sumpf", "moor"]),
  magical: Object.freeze(["magical", "magisch", "planar", "anomalous"])
});

export function configuredClimateSourceMode() {
  return normalizeClimateSourceMode(safeSetting("climateSourceMode", "scene"));
}

export function configuredManualClimateZone(fallback = "temperate") {
  const raw = safeSetting("manualClimateZone", fallback);
  return Object.hasOwn(CLIMATE_ZONES, raw) ? raw : fallback;
}

export function configuredCityForgeSettlementId() {
  return String(safeSetting("cityForgeSettlementId", "") ?? "").trim();
}

export function getCityForgeApi() {
  const module = globalThis.game?.modules?.get?.(CITY_FORGE_MODULE_ID);
  if (!module?.active) return null;
  return module.api ?? null;
}

export function cityForgeRuntimeStatus() {
  const module = globalThis.game?.modules?.get?.(CITY_FORGE_MODULE_ID) ?? null;
  const api = getCityForgeApi();
  const sceneApi = Boolean(api?.integrations && typeof api.integrations.getContextForScene === "function");
  const settlementApi = Boolean(
    api?.settlements
    && typeof api.settlements.list === "function"
    && api?.integrations?.weather
    && typeof api.integrations.weather.getContext === "function"
  );

  return Object.freeze({
    installed: Boolean(module),
    active: Boolean(module?.active),
    compatible: sceneApi || settlementApi,
    sceneCompatible: sceneApi,
    settlementCompatible: settlementApi,
    moduleVersion: module?.version ?? module?.manifest?.version ?? null
  });
}

export function activeSceneUuid() {
  const canvasUuid = globalThis.canvas?.scene?.uuid;
  if (canvasUuid) return canvasUuid;

  const currentUuid = globalThis.game?.scenes?.current?.uuid;
  if (currentUuid) return currentUuid;

  const viewedId = globalThis.game?.user?.viewedScene;
  const viewed = viewedId ? globalThis.game?.scenes?.get?.(viewedId) : null;
  return viewed?.uuid ?? null;
}

export async function listCityForgeSettlements() {
  const api = getCityForgeApi();
  if (!api?.settlements || typeof api.settlements.list !== "function") return [];

  try {
    const settlements = await api.settlements.list();
    return settlements
      .map((settlement) => ({
        id: settlement.id,
        name: settlement.definition?.identity?.name ?? settlement.id,
        level: settlement.definition?.identity?.level ?? 0,
        type: settlement.definition?.identity?.type ?? "",
        climate: settlement.definition?.geography?.climate ?? "",
        region: settlement.definition?.geography?.region ?? ""
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not list City Forge settlements`, error);
    return [];
  }
}

export async function getCityWeatherContext(sceneUuid = activeSceneUuid()) {
  const api = getCityForgeApi();
  if (!sceneUuid || typeof api?.integrations?.getContextForScene !== "function") return null;

  try {
    return await api.integrations.getContextForScene(sceneUuid, "weather");
  } catch (error) {
    console.warn(`${MODULE_ID} | City Forge Scene weather context failed`, error);
    return null;
  }
}

export async function getCityWeatherContextForSettlement(settlementId = configuredCityForgeSettlementId()) {
  const id = String(settlementId ?? "").trim();
  const api = getCityForgeApi();
  if (!id || typeof api?.integrations?.weather?.getContext !== "function") return null;

  try {
    return await api.integrations.weather.getContext(id);
  } catch (error) {
    console.warn(`${MODULE_ID} | City Forge settlement weather context failed`, error);
    return null;
  }
}

export async function resolveEffectiveClimateContext({
  manualClimateZone = configuredManualClimateZone(),
  sceneUuid = activeSceneUuid(),
  sourceMode = configuredClimateSourceMode(),
  settlementId = configuredCityForgeSettlementId()
} = {}) {
  const mode = normalizeClimateSourceMode(sourceMode);
  const fallback = Object.hasOwn(CLIMATE_ZONES, manualClimateZone) ? manualClimateZone : "temperate";
  const selectedSettlementId = String(settlementId ?? "").trim();
  const status = cityForgeRuntimeStatus();

  if (mode === "manual") {
    return freezeResult(baseResolution({
      sourceMode: mode,
      source: "manual",
      sceneUuid,
      settlementId: selectedSettlementId,
      fallback,
      status,
      reason: "manual-mode"
    }));
  }

  if (!status.active) {
    return freezeResult(baseResolution({
      sourceMode: mode,
      source: "manual",
      sceneUuid,
      settlementId: selectedSettlementId,
      fallback,
      status,
      reason: "city-unavailable"
    }));
  }

  let context = null;
  let reason = "";
  if (mode === "settlement") {
    if (!selectedSettlementId) {
      return freezeResult(baseResolution({
        sourceMode: mode,
        source: "manual",
        sceneUuid,
        settlementId: selectedSettlementId,
        fallback,
        status,
        reason: "settlement-unselected"
      }));
    }
    if (!status.settlementCompatible) {
      return freezeResult(baseResolution({
        sourceMode: mode,
        source: "manual",
        sceneUuid,
        settlementId: selectedSettlementId,
        fallback,
        status,
        reason: "city-api-incompatible"
      }));
    }
    context = await getCityWeatherContextForSettlement(selectedSettlementId);
    reason = context ? "city-settlement" : "settlement-not-found";
  } else {
    if (!status.sceneCompatible) {
      return freezeResult(baseResolution({
        sourceMode: mode,
        source: "manual",
        sceneUuid,
        settlementId: selectedSettlementId,
        fallback,
        status,
        reason: "city-api-incompatible"
      }));
    }
    if (!sceneUuid) {
      return freezeResult(baseResolution({
        sourceMode: mode,
        source: "manual",
        sceneUuid,
        settlementId: selectedSettlementId,
        fallback,
        status,
        reason: "no-active-scene"
      }));
    }
    context = await getCityWeatherContext(sceneUuid);
    reason = context ? "city-scene" : "scene-unlinked";
  }

  if (!context) {
    return freezeResult(baseResolution({
      sourceMode: mode,
      source: "manual",
      sceneUuid,
      settlementId: selectedSettlementId,
      fallback,
      status,
      reason
    }));
  }

  const mapping = mapCityContextToClimate(context);
  if (!mapping) {
    return freezeResult({
      ...baseResolution({
        sourceMode: mode,
        source: "manual",
        sceneUuid,
        settlementId: selectedSettlementId,
        fallback,
        status,
        reason: "city-climate-unmapped"
      }),
      context
    });
  }

  return freezeResult({
    sourceMode: mode,
    source: "cityForge",
    sceneUuid,
    selectedSettlementId,
    effectiveClimateZone: mapping.climateZone,
    manualClimateZone: fallback,
    cityForge: status,
    context,
    mapped: true,
    mappingField: mapping.field,
    mappingValue: mapping.value,
    reason
  });
}

export function mapCityContextToClimate(context) {
  const climate = String(context?.geography?.climate ?? "").trim();
  const terrain = String(context?.geography?.terrain ?? "").trim();

  // City Forge 0.8.2+ stores Weather Forge's canonical climate ids directly.
  if (Object.hasOwn(CLIMATE_ZONES, climate)) {
    return { climateZone: climate, field: "climate", value: climate };
  }

  // Backward compatibility for City Forge <= 0.8.1 and imported legacy settlements.
  const directClimate = mapTextToClimate(climate, CLIMATE_ALIASES);
  if (directClimate) return { climateZone: directClimate, field: "climate", value: climate };

  const terrainClimate = mapTextToClimate(terrain, TERRAIN_ALIASES);
  if (terrainClimate) return { climateZone: terrainClimate, field: "terrain", value: terrain };

  return null;
}

export function annotateWeatherWithClimateContext(weather, resolution) {
  const output = structuredClone(weather ?? {});
  output.weatherForgeClimateSource = resolution?.source ?? "manual";
  output.weatherForgeClimateReason = resolution?.reason ?? "manual-mode";

  const context = resolution?.context;
  if (context) {
    output.weatherForgeCityContext = {
      sourceMode: resolution.sourceMode ?? "scene",
      sceneUuid: resolution.sceneUuid ?? context.scope?.sceneUuid ?? null,
      selectedSettlementId: resolution.selectedSettlementId ?? null,
      settlementId: context.settlement?.id ?? null,
      settlementName: context.settlement?.name ?? null,
      settlementRevision: context.settlement?.revision ?? null,
      districtId: context.scope?.district?.id ?? null,
      districtName: context.scope?.district?.name ?? null,
      locationId: context.scope?.location?.id ?? null,
      locationName: context.scope?.location?.name ?? null,
      region: context.geography?.region ?? "",
      terrain: context.geography?.terrain ?? "",
      climate: context.geography?.climate ?? "",
      resolvedClimateZone: resolution.effectiveClimateZone ?? output.climateZone ?? null,
      mappingField: resolution.mappingField ?? null,
      mappingValue: resolution.mappingValue ?? null
    };
  } else {
    output.weatherForgeCityContext = null;
  }

  return output;
}

export function weatherContextMismatch(weather, resolution) {
  const stored = weather?.weatherForgeCityContext ?? null;
  if (!stored || weather?.weatherForgeClimateSource !== "cityForge") return false;
  if (resolution?.source !== "cityForge") return false;

  const activeSettlement = resolution.context?.settlement?.id ?? null;
  const activeLocation = resolution.context?.scope?.location?.id ?? null;
  const activeDistrict = resolution.context?.scope?.district?.id ?? null;

  if (stored.settlementId !== activeSettlement) return true;
  if ((stored.locationId ?? null) !== (activeLocation ?? null)) return true;
  if (!stored.locationId && (stored.districtId ?? null) !== (activeDistrict ?? null)) return true;
  if (
    stored.settlementRevision != null
    && resolution.context?.settlement?.revision != null
    && stored.settlementRevision !== resolution.context.settlement.revision
  ) return true;
  if (
    stored.resolvedClimateZone
    && resolution.effectiveClimateZone
    && stored.resolvedClimateZone !== resolution.effectiveClimateZone
  ) return true;
  return false;
}

export function climateContextSignature(resolution) {
  return JSON.stringify({
    sourceMode: resolution?.sourceMode ?? "scene",
    source: resolution?.source ?? "manual",
    sceneUuid: resolution?.sceneUuid ?? null,
    selectedSettlementId: resolution?.selectedSettlementId ?? null,
    settlementId: resolution?.context?.settlement?.id ?? null,
    revision: resolution?.context?.settlement?.revision ?? null,
    districtId: resolution?.context?.scope?.district?.id ?? null,
    locationId: resolution?.context?.scope?.location?.id ?? null,
    climateZone: resolution?.effectiveClimateZone ?? null
  });
}

export async function initializeCityForgeClimateSettings() {
  const state = safeSetting("cityForgeIntegrationState", { version: 0 }) ?? { version: 0 };
  if (Number(state.version ?? 0) >= 2) return state;

  const current = safeSetting("weatherState", null);
  const inherited = current?.climateZone;
  const manual = Object.hasOwn(CLIMATE_ZONES, inherited) ? inherited : configuredManualClimateZone("temperate");
  const mode = normalizeClimateSourceMode(safeSetting("climateSourceMode", "scene"));

  await safeSet("manualClimateZone", manual);
  await safeSet("climateSourceMode", mode);

  const next = {
    version: 2,
    migratedManualClimateZone: manual,
    migratedClimateSourceMode: mode
  };
  await safeSet("cityForgeIntegrationState", next);
  return next;
}

export function currentWeatherIntegrationContext(weather, resolution) {
  return Object.freeze({
    schema: "pf2e-weather-forge/current-weather-context",
    version: 1,
    weather: structuredClone(weather),
    climateResolution: structuredClone(resolution),
    provenance: weather?.weatherForgeCityContext
      ? structuredClone(weather.weatherForgeCityContext)
      : null,
    mismatch: weatherContextMismatch(weather, resolution)
  });
}

function normalizeClimateSourceMode(value) {
  return LEGACY_MODE_MAP[String(value ?? "").trim()] ?? "scene";
}

function baseResolution({
  sourceMode,
  source,
  sceneUuid,
  settlementId,
  fallback,
  status,
  reason
}) {
  return {
    sourceMode,
    source,
    sceneUuid,
    selectedSettlementId: settlementId,
    effectiveClimateZone: fallback,
    manualClimateZone: fallback,
    cityForge: status,
    context: null,
    mapped: false,
    mappingField: null,
    mappingValue: null,
    reason
  };
}

function mapTextToClimate(value, registry) {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (Object.hasOwn(CLIMATE_ZONES, normalized)) return normalized;

  for (const [zone, aliases] of Object.entries(registry)) {
    if (aliases.some((alias) => textContainsAlias(normalized, normalizeText(alias)))) return zone;
  }
  return null;
}

function textContainsAlias(text, alias) {
  if (!alias) return false;
  if (text === alias) return true;
  return ` ${text} `.includes(` ${alias} `)
    || text.startsWith(`${alias} `)
    || text.endsWith(` ${alias}`);
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ß", "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function safeSetting(key, fallback) {
  try {
    const value = globalThis.game?.settings?.get?.(MODULE_ID, key);
    return value ?? fallback;
  } catch (_) {
    return fallback;
  }
}

async function safeSet(key, value) {
  try {
    return await globalThis.game?.settings?.set?.(MODULE_ID, key, value);
  } catch (_) {
    return value;
  }
}

function freezeResult(value) {
  return deepFreeze(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
