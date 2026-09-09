import { MODULE_ID } from "./weather-engine.js";

export const AMBIENCE_FORGE_MODULE_ID = "ambience-forge";
export const AMBIENCE_OWNER_ID = MODULE_ID;
export const AMBIENCE_WEATHER_GROUP_DEFAULT = "weather";
export const AMBIENCE_WIND_GROUP_DEFAULT = "wind";

export const AMBIENCE_WEATHER_KINDS = Object.freeze([
  "clear",
  "cloudy",
  "fog",
  "rain",
  "heavy-rain",
  "storm",
  "snow",
  "blizzard"
]);

export const DEFAULT_AMBIENCE_WEATHER_MAPPING = Object.freeze({
  clear: "clear",
  cloudy: "cloudy",
  fog: "fog",
  rain: "rain",
  "heavy-rain": "heavy-rain",
  storm: "storm",
  snow: "snow",
  blizzard: "heavy-snow"
});

export const AMBIENCE_WIND_KINDS = Object.freeze([
  "calm",
  "breeze",
  "windy",
  "strong-wind",
  "gale"
]);

export const DEFAULT_AMBIENCE_WIND_MAPPING = Object.freeze({
  calm: "calm",
  breeze: "breeze",
  windy: "windy",
  "strong-wind": "strong-wind",
  gale: "gale"
});

function settingValue(key, fallback) {
  try {
    return game.settings.get(MODULE_ID, key) ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function isPrimaryActiveGM() {
  if (!globalThis.game?.user?.isGM) return false;
  const activeGM = game.users?.activeGM;
  if (activeGM) return activeGM.id === game.user.id;
  const first = [...(game.users ?? [])].find(user => user.active && user.isGM);
  return !first || first.id === game.user.id;
}

export function normalizeAmbienceWeatherMapping(mapping = null) {
  const source = mapping && typeof mapping === "object" ? mapping : {};
  return Object.fromEntries(AMBIENCE_WEATHER_KINDS.map((key) => [
    key,
    String(source[key] ?? DEFAULT_AMBIENCE_WEATHER_MAPPING[key] ?? "").trim()
  ]));
}

export function normalizeAmbienceWindMapping(mapping = null) {
  const source = mapping && typeof mapping === "object" ? mapping : {};
  return Object.fromEntries(AMBIENCE_WIND_KINDS.map((key) => [
    key,
    String(source[key] ?? DEFAULT_AMBIENCE_WIND_MAPPING[key] ?? "").trim()
  ]));
}

export function resolveAmbienceWindKind(weather = {}) {
  const value = Math.max(0, Math.min(12, Number(weather?.windStrength ?? 0) || 0));
  if (value <= 0) return "calm";
  if (value <= 2) return "breeze";
  if (value <= 5) return "windy";
  if (value <= 8) return "strong-wind";
  return "gale";
}

export function resolveAmbienceWeatherKind(weather = {}) {
  const extremeType = String(weather?.extremeWeather?.type ?? "").trim();
  if (extremeType === "blizzard") return "blizzard";
  if (extremeType === "storm") return "storm";
  if (extremeType === "fog") return "fog";

  const precipitation = String(weather?.precipitation ?? "none");
  if (precipitation === "thunderstorm") return "storm";
  if (precipitation === "heavyRain") return "heavy-rain";
  if (["rain", "lightRain", "drizzle"].includes(precipitation)) return "rain";
  if (precipitation === "snow") return "snow";
  if (precipitation === "mist") return "fog";

  return Number(weather?.cloudDensity ?? 0) >= 70 ? "cloudy" : "clear";
}

export function configuredAmbienceIntegrationEnabled() {
  return Boolean(settingValue("ambienceIntegrationEnabled", false));
}

export function configuredAmbienceGroupKey() {
  return String(settingValue("ambienceStateGroupKey", AMBIENCE_WEATHER_GROUP_DEFAULT) || AMBIENCE_WEATHER_GROUP_DEFAULT).trim();
}

export function configuredAmbienceWeatherMapping() {
  return normalizeAmbienceWeatherMapping(settingValue("ambienceWeatherMapping", DEFAULT_AMBIENCE_WEATHER_MAPPING));
}

export function configuredAmbienceWindIntegrationEnabled() {
  return Boolean(settingValue("ambienceWindIntegrationEnabled", false));
}

export function configuredAmbienceWindGroupKey() {
  return String(settingValue("ambienceWindStateGroupKey", AMBIENCE_WIND_GROUP_DEFAULT) || AMBIENCE_WIND_GROUP_DEFAULT).trim();
}

export function configuredAmbienceWindMapping() {
  return normalizeAmbienceWindMapping(settingValue("ambienceWindMapping", DEFAULT_AMBIENCE_WIND_MAPPING));
}

export function configuredAmbienceAutoStartEnabled() {
  return Boolean(settingValue("ambienceAutoStartEnabled", false));
}

export function configuredAmbienceCompositionId() {
  return String(settingValue("ambienceCompositionId", "") ?? "").trim();
}


export function getAmbienceForgeApi() {
  const module = globalThis.game?.modules?.get?.(AMBIENCE_FORGE_MODULE_ID);
  if (!module?.active) return null;
  return module.api ?? null;
}

function capabilityList(api) {
  if (!api) return [];
  if (Array.isArray(api.capabilities)) return api.capabilities;
  if (api.capabilities && typeof api.capabilities === "object") {
    return Object.entries(api.capabilities).filter(([, value]) => Boolean(value)).map(([key]) => key);
  }
  return [];
}

export function ambienceForgeRuntimeStatus() {
  const module = globalThis.game?.modules?.get?.(AMBIENCE_FORGE_MODULE_ID);
  const api = module?.active ? module.api ?? null : null;
  const capabilities = capabilityList(api);
  const contextCompatible = Boolean(api?.setContextState) && capabilities.includes("context-states-v1");
  const discoveryCompatible = Boolean(api?.getStateCatalog) && capabilities.includes("state-discovery-v1");
  const playbackCompatible = Boolean(api?.requestAmbience) && Boolean(api?.releaseAmbience);
  return {
    installed: Boolean(module),
    active: Boolean(module?.active),
    apiVersion: api?.version ?? null,
    compatible: contextCompatible,
    discovery: discoveryCompatible,
    playback: playbackCompatible,
    capabilities
  };
}

export function getAmbienceStateCatalog() {
  const status = ambienceForgeRuntimeStatus();
  if (!status.discovery) return { compositions: [] };
  try {
    const catalog = getAmbienceForgeApi()?.getStateCatalog?.();
    return catalog && Array.isArray(catalog.compositions) ? catalog : { compositions: [] };
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not read Ambience Forge state catalog`, error);
    return { compositions: [] };
  }
}

export function aggregateAmbienceStateGroups(catalog = getAmbienceStateCatalog()) {
  const groups = new Map();
  for (const composition of catalog?.compositions ?? []) {
    for (const group of composition?.groups ?? []) {
      const key = String(group?.key ?? "").trim();
      if (!key) continue;
      let entry = groups.get(key);
      if (!entry) {
        entry = { key, names: new Set(), states: new Map(), compositionCount: 0 };
        groups.set(key, entry);
      }
      entry.compositionCount += 1;
      if (group?.name) entry.names.add(String(group.name));
      for (const state of group?.states ?? []) {
        const stateKey = String(state?.key ?? "").trim();
        if (!stateKey) continue;
        let stateEntry = entry.states.get(stateKey);
        if (!stateEntry) {
          stateEntry = { key: stateKey, names: new Set(), compositionCount: 0 };
          entry.states.set(stateKey, stateEntry);
        }
        stateEntry.compositionCount += 1;
        if (state?.name) stateEntry.names.add(String(state.name));
      }
    }
  }

  return [...groups.values()]
    .map((entry) => ({
      key: entry.key,
      names: [...entry.names],
      compositionCount: entry.compositionCount,
      states: [...entry.states.values()]
        .map((state) => ({ ...state, names: [...state.names] }))
        .sort((a, b) => a.key.localeCompare(b.key))
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function getAmbienceOwnedCompositionIds() {
  const api = getAmbienceForgeApi();
  if (!api?.getState) return [];
  try {
    const state = api.getState() ?? {};
    return Object.entries(state.owners ?? {})
      .filter(([, owners]) => Array.isArray(owners) && owners.includes(AMBIENCE_OWNER_ID))
      .map(([ambienceId]) => String(ambienceId));
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not inspect Ambience Forge ownership`, error);
    return [];
  }
}

export async function syncAmbienceOwnedComposition({ force = false } = {}) {
  if (!isPrimaryActiveGM()) return false;
  const api = getAmbienceForgeApi();
  const status = ambienceForgeRuntimeStatus();
  if (!api || !status.playback) return false;

  const desiredId = configuredAmbienceIntegrationEnabled() && configuredAmbienceAutoStartEnabled()
    ? configuredAmbienceCompositionId()
    : "";
  const ownedIds = getAmbienceOwnedCompositionIds();

  for (const ambienceId of ownedIds) {
    if (ambienceId === desiredId) continue;
    try {
      await api.releaseAmbience(ambienceId, { owner: AMBIENCE_OWNER_ID });
    } catch (error) {
      console.warn(`${MODULE_ID} | Could not release Ambience Forge composition ${ambienceId}`, error);
    }
  }

  if (!desiredId) return true;
  if (!force && ownedIds.includes(desiredId)) return true;

  try {
    await api.requestAmbience(desiredId, { owner: AMBIENCE_OWNER_ID });
    return true;
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not start Ambience Forge composition ${desiredId}`, error);
    return false;
  }
}

const lastPublishedSignatures = new Map();
const lastPublishedGroupKeys = new Map();

async function clearOwnedContext({ slot, groupKey, force = false } = {}) {
  if (!isPrimaryActiveGM()) return false;
  const api = getAmbienceForgeApi();
  const status = ambienceForgeRuntimeStatus();
  const normalizedGroup = String(groupKey ?? "").trim();
  if (!api || !status.compatible || !normalizedGroup) return false;

  const signature = `clear:${normalizedGroup}`;
  if (!force && lastPublishedSignatures.get(slot) === signature) return true;

  try {
    const result = await api.clearContextState({ group: normalizedGroup, owner: AMBIENCE_OWNER_ID });
    if (result === false) return false;
    lastPublishedSignatures.set(slot, signature);
    lastPublishedGroupKeys.set(slot, normalizedGroup);
    return true;
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not clear Ambience Forge ${slot} context`, error);
    return false;
  }
}

async function publishOwnedContext({ slot, groupKey, stateKey, force = false } = {}) {
  const api = getAmbienceForgeApi();
  const status = ambienceForgeRuntimeStatus();
  const normalizedGroup = String(groupKey ?? "").trim();
  const normalizedState = String(stateKey ?? "").trim();
  if (!api || !status.compatible || !normalizedGroup || !normalizedState) return false;

  const staleGroupKey = lastPublishedGroupKeys.get(slot);
  if (staleGroupKey && staleGroupKey !== normalizedGroup) {
    try {
      const cleared = await api.clearContextState({ group: staleGroupKey, owner: AMBIENCE_OWNER_ID });
      if (cleared === false) return false;
    } catch (error) {
      console.warn(`${MODULE_ID} | Could not clear previous Ambience Forge ${slot} group`, error);
      return false;
    }
  }

  const signature = `${normalizedGroup}:${normalizedState}`;
  if (!force && lastPublishedSignatures.get(slot) === signature) return true;

  try {
    const result = await api.setContextState({
      group: normalizedGroup,
      state: normalizedState,
      owner: AMBIENCE_OWNER_ID
    });
    if (result === false) return false;
    lastPublishedSignatures.set(slot, signature);
    lastPublishedGroupKeys.set(slot, normalizedGroup);
    return true;
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not synchronize ${slot} with Ambience Forge`, error);
    return false;
  }
}

export async function clearAmbienceWeatherContext({ groupKey = configuredAmbienceGroupKey(), force = false } = {}) {
  return clearOwnedContext({ slot: "weather", groupKey, force });
}

export async function clearAmbienceWindContext({ groupKey = configuredAmbienceWindGroupKey(), force = false } = {}) {
  return clearOwnedContext({ slot: "wind", groupKey, force });
}

export async function syncAmbienceFromWeather(weather, {
  force = false,
  previousGroupKey = null,
  previousWindGroupKey = null
} = {}) {
  if (!isPrimaryActiveGM()) return false;

  const api = getAmbienceForgeApi();
  const status = ambienceForgeRuntimeStatus();
  if (!api || !status.compatible) return false;

  const weatherGroupKey = configuredAmbienceGroupKey();
  const previousWeatherGroup = previousGroupKey || lastPublishedGroupKeys.get("weather");
  if (previousWeatherGroup && previousWeatherGroup !== weatherGroupKey) {
    const cleared = await clearOwnedContext({ slot: "weather", groupKey: previousWeatherGroup, force: true });
    if (!cleared) return false;
  }

  const windGroupKey = configuredAmbienceWindGroupKey();
  const previousWindGroup = previousWindGroupKey || lastPublishedGroupKeys.get("wind");
  if (previousWindGroup && previousWindGroup !== windGroupKey) {
    const cleared = await clearOwnedContext({ slot: "wind", groupKey: previousWindGroup, force: true });
    if (!cleared) return false;
  }

  if (!configuredAmbienceIntegrationEnabled()) {
    await clearAmbienceWeatherContext({ groupKey: weatherGroupKey, force: true });
    const publishedWindGroup = lastPublishedGroupKeys.get("wind");
    if (publishedWindGroup) await clearAmbienceWindContext({ groupKey: publishedWindGroup, force: true });
    await syncAmbienceOwnedComposition({ force: true });
    return true;
  }

  const weatherKind = resolveAmbienceWeatherKind(weather);
  const weatherMapping = configuredAmbienceWeatherMapping();
  const weatherStateKey = String(weatherMapping[weatherKind] ?? "").trim();
  if (!weatherGroupKey || !weatherStateKey) {
    await clearAmbienceWeatherContext({ groupKey: weatherGroupKey, force: true });
    await syncAmbienceOwnedComposition({ force: true });
    return false;
  }

  const weatherResult = await publishOwnedContext({
    slot: "weather",
    groupKey: weatherGroupKey,
    stateKey: weatherStateKey,
    force
  });
  if (!weatherResult) return false;

  if (configuredAmbienceWindIntegrationEnabled()) {
    const windKind = resolveAmbienceWindKind(weather);
    const windMapping = configuredAmbienceWindMapping();
    const windStateKey = String(windMapping[windKind] ?? "").trim();
    if (windGroupKey && windStateKey) {
      const windResult = await publishOwnedContext({
        slot: "wind",
        groupKey: windGroupKey,
        stateKey: windStateKey,
        force
      });
      if (!windResult) return false;
    } else if (windGroupKey) {
      await clearAmbienceWindContext({ groupKey: windGroupKey, force: true });
    }
  } else {
    const publishedWindGroup = lastPublishedGroupKeys.get("wind");
    if (publishedWindGroup) await clearAmbienceWindContext({ groupKey: publishedWindGroup, force: true });
  }

  const playbackResult = await syncAmbienceOwnedComposition({ force });
  return playbackResult !== false;
}

export async function syncAmbienceFromCurrentWeather(options = {}) {
  const weather = settingValue("weatherState", null);
  if (!weather) return false;
  return syncAmbienceFromWeather(weather, options);
}

let ambienceSyncTimer = null;

export function scheduleAmbienceSync({ delayMs = 0 } = {}) {
  if (!isPrimaryActiveGM()) return;
  if (ambienceSyncTimer) clearTimeout(ambienceSyncTimer);
  ambienceSyncTimer = setTimeout(() => {
    ambienceSyncTimer = null;
    void syncAmbienceFromCurrentWeather({ force: true });
  }, Math.max(0, Number(delayMs) || 0));
}

export function resetAmbienceSyncSignature() {
  lastPublishedSignatures.clear();
  lastPublishedGroupKeys.clear();
}
