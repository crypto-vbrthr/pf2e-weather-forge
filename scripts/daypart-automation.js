import { MODULE_ID, CLIMATE_ZONES, defaultWeatherState, generateWeatherForTarget } from "./weather-engine.js";
import { appendWeatherHistory } from "./history-engine.js";
import { getForecastState } from "./forecast-engine.js";
import {
  effectiveCalendarSourceMode,
  getCalendarForgePhaseInfo,
  enumerateCalendarForgePhaseBoundaries
} from "./calendar-source.js";
import {
  annotateWeatherWithClimateContext,
  configuredManualClimateZone,
  resolveEffectiveClimateContext
} from "./city-source.js";

const RUNTIME_STATE_VERSION = 2;

export function defaultCalendarDrivenState() {
  return {
    stateVersion: RUNTIME_STATE_VERSION,
    initialized: false,
    lastWorldTime: null,
    currentPhaseKey: null,
    resolvedPhaseKey: null,
    phaseBaseWeather: null,
    queuedPreview: null,
    sourceSignature: null,
    lastCatchupCount: 0
  };
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function getState() {
  const stored = game.settings.get(MODULE_ID, "calendarDrivenState");
  return { ...defaultCalendarDrivenState(), ...(stored && typeof stored === "object" ? stored : {}) };
}

async function setState(state) {
  state.stateVersion = RUNTIME_STATE_VERSION;
  await game.settings.set(MODULE_ID, "calendarDrivenState", state);
  return state;
}

export async function resetCalendarDrivenState() {
  const state = defaultCalendarDrivenState();
  await game.settings.set(MODULE_ID, "calendarDrivenState", state);
  await game.settings.set(MODULE_ID, "weatherPreview", null);
  return state;
}

function sourceSignature() {
  const source = String(game.settings.get(MODULE_ID, "calendarSourceMode") ?? "auto");
  const region = String(game.settings.get(MODULE_ID, "calendarForgeRegionId") ?? "");
  const moon = String(game.settings.get(MODULE_ID, "calendarForgeMoonId") ?? "");
  const boundaries = JSON.stringify(game.settings.get(MODULE_ID, "daypartBoundaries") ?? {});
  return `${source}|${region}|${moon}|${boundaries}`;
}

function generationSettings(weather) {
  return {
    climateZone: configuredManualClimateZone(weather?.climateZone ?? "temperate"),
    allowExtreme: game.settings.get(MODULE_ID, "allowExtreme") ?? true,
    extremeFrequency: game.settings.get(MODULE_ID, "extremeFrequency") ?? "normal",
    forceExtreme: false,
    forecast: getForecastState()
  };
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableObject(value[key])]));
}

export function weatherFingerprint(weather) {
  const source = {
    climateZone: weather?.climateZone ?? null,
    temperature: Number(weather?.temperature ?? 0),
    dailyProfile: {
      minTemp: Number(weather?.dailyProfile?.minTemp ?? weather?.temperature ?? 0),
      maxTemp: Number(weather?.dailyProfile?.maxTemp ?? weather?.temperature ?? 0),
      trend: weather?.dailyProfile?.trend ?? "stable"
    },
    precipitation: weather?.precipitation ?? "none",
    humidity: Number(weather?.humidity ?? 0),
    cloudDensity: Number(weather?.cloudDensity ?? 0),
    windStrength: Number(weather?.windStrength ?? 0),
    extremeWeather: weather?.extremeWeather ? {
      type: weather.extremeWeather.type ?? null,
      phase: weather.extremeWeather.phase ?? null,
      intensity: Number(weather.extremeWeather.intensity ?? 0),
      remainingSegments: Number(weather.extremeWeather.remainingSegments ?? 0)
    } : null
  };
  return JSON.stringify(stableObject(source));
}

export function phaseContextSignature(phase) {
  const c = phase?.calendar ?? {};
  return JSON.stringify({
    phaseKey: phase?.key ?? null,
    segment: phase?.segment ?? null,
    year: c.year ?? null,
    month: c.month ?? null,
    dayOfMonth: c.dayOfMonth ?? null,
    weekday: c.weekday ?? null,
    season: c.season ?? null,
    moonId: c.moonId ?? null,
    moonPhase: c.moonPhase ?? null,
    calendarId: c.calendarId ?? null,
    regionId: c.regionId ?? null
  });
}

function annotateWeather(weather, phase, resolution) {
  return {
    ...weather,
    weatherForgeCalendarSource: "calendarForge",
    weatherForgeWorldTime: phase.startWorldTime,
    weatherForgePhaseKey: phase.key,
    weatherForgeResolution: resolution,
    weatherForgeContextSignature: phaseContextSignature(phase),
    calendarLabels: clone(phase.calendar.calendarLabels ?? {})
  };
}

function metadataOnlyWeather(weather, phase) {
  return annotateWeather(
    { ...weather, ...phase.calendar, timeSegment: phase.segment },
    phase,
    weather?.weatherForgeResolution ?? "carried"
  );
}

async function refreshStoredWeatherMetadata(weather, phase) {
  const refreshed = metadataOnlyWeather(weather, phase);
  await game.settings.set(MODULE_ID, "weatherState", refreshed);
  return refreshed;
}

async function commitWeather(weather, phase, resolution, { history = true } = {}) {
  const committed = annotateWeather(weather, phase, resolution);
  await game.settings.set(MODULE_ID, "weatherState", committed);
  if (history) {
    await appendWeatherHistory(committed, {
      worldTime: phase.startWorldTime,
      calendarSource: "calendarForge",
      calendarId: phase.calendar.calendarId,
      regionId: phase.calendar.regionId,
      formattedDate: phase.calendar.formattedDate
    });
  }
  return committed;
}

async function generateForPhase(baseWeather, phase, resolution = "automatic", settingsOverride = {}) {
  const climateContext = await resolveEffectiveClimateContext({
    manualClimateZone: configuredManualClimateZone(baseWeather?.climateZone ?? "temperate")
  });
  const target = { ...phase.calendar, timeSegment: phase.segment };
  const generated = generateWeatherForTarget(baseWeather, target, {
    ...generationSettings(baseWeather),
    ...settingsOverride,
    climateZone: settingsOverride.climateZone || climateContext.effectiveClimateZone
  });
  return annotateWeatherWithClimateContext(
    annotateWeather(generated, phase, resolution),
    climateContext
  );
}

function automationMode() {
  return String(game.settings.get(MODULE_ID, "daypartAutomationMode") ?? "manual") === "automatic"
    ? "automatic"
    : "manual";
}

function notify(key, data = {}) {
  if (!game.user?.isGM) return;
  try { ui.notifications.info(game.i18n.format(`${MODULE_ID}.${key}`, data)); }
  catch (_) { ui.notifications.info(game.i18n.localize(`${MODULE_ID}.${key}`)); }
}

function warn(key, data = {}) {
  if (!game.user?.isGM) return;
  try { ui.notifications.warn(game.i18n.format(`${MODULE_ID}.${key}`, data)); }
  catch (_) { ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.${key}`)); }
}

function currentWeather() {
  return game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState();
}

function previewCompatibleWithPhase(preview, phase) {
  return Boolean(
    preview
    && preview.weatherForgePhaseKey === phase?.key
    && (!preview.weatherForgeContextSignature || preview.weatherForgeContextSignature === phaseContextSignature(phase))
  );
}

export function queuedPreviewIsValid(queued, baseWeather, phase, signature = sourceSignature()) {
  if (!queued?.weather || !phase) return false;
  if (queued.phaseKey !== phase.key) return false;
  if (queued.sourceSignature && queued.sourceSignature !== signature) return false;
  if (queued.targetContextSignature && queued.targetContextSignature !== phaseContextSignature(phase)) return false;
  if (queued.baseFingerprint && queued.baseFingerprint !== weatherFingerprint(baseWeather)) return false;
  return true;
}

export async function initializeCalendarDrivenWeather({ force = false } = {}) {
  if (effectiveCalendarSourceMode() !== "calendarForge") return null;
  const phase = await getCalendarForgePhaseInfo(game.time.worldTime);
  if (!phase) return null;

  let state = getState();
  const signature = sourceSignature();
  const weather = currentWeather();

  if (weather.weatherForgeCalendarSource !== "calendarForge") force = true;

  if (!force && state.initialized && state.sourceSignature === signature) {
    state.currentPhaseKey = phase.key;
    await setState(state);
    return state;
  }

  const adopted = annotateWeather({ ...weather, ...phase.calendar, timeSegment: phase.segment }, phase, "carried");
  await game.settings.set(MODULE_ID, "weatherState", adopted);
  await game.settings.set(MODULE_ID, "weatherPreview", null);
  state = {
    ...defaultCalendarDrivenState(),
    initialized: true,
    lastWorldTime: Number(game.time.worldTime),
    currentPhaseKey: phase.key,
    resolvedPhaseKey: phase.key,
    phaseBaseWeather: clone(adopted),
    queuedPreview: null,
    sourceSignature: signature
  };
  await setState(state);
  return state;
}

async function resolvePhaseAutomatically(baseWeather, phase, resolution = "automatic") {
  const generated = await generateForPhase(baseWeather, phase, resolution);
  return commitWeather(generated, phase, resolution);
}

async function checkpoint(state, worldTime) {
  state.lastWorldTime = Number(worldTime);
  state.sourceSignature = sourceSignature();
  await setState(state);
}

export async function processCalendarWorldTimeChange(worldTime, delta = 0) {
  if (effectiveCalendarSourceMode() !== "calendarForge") return { active: false };

  let state = getState();
  const signature = sourceSignature();
  if (!state.initialized || state.sourceSignature !== signature || currentWeather().weatherForgeCalendarSource !== "calendarForge") {
    state = await initializeCalendarDrivenWeather({ force: true });
  }
  if (!state) return { active: false };

  const to = Number(worldTime);
  const from = Number.isFinite(Number(state.lastWorldTime)) ? Number(state.lastWorldTime) : to - Number(delta || 0);
  const targetPhase = await getCalendarForgePhaseInfo(to);
  if (!targetPhase) return { active: false };

  if (to < from) {
    const carried = metadataOnlyWeather(currentWeather(), targetPhase);
    await game.settings.set(MODULE_ID, "weatherState", carried);
    await game.settings.set(MODULE_ID, "weatherPreview", null);
    state = {
      ...state,
      lastWorldTime: to,
      currentPhaseKey: targetPhase.key,
      resolvedPhaseKey: targetPhase.key,
      phaseBaseWeather: clone(carried),
      queuedPreview: null,
      sourceSignature: signature,
      lastCatchupCount: 0
    };
    await setState(state);
    notify("notification.calendarTimeRewound");
    return { active: true, backward: true, phase: targetPhase };
  }

  const boundaries = await enumerateCalendarForgePhaseBoundaries(from, to);

  if (!boundaries.length) {
    const existingPreview = game.settings.get(MODULE_ID, "weatherPreview");
    if (existingPreview && !previewCompatibleWithPhase(existingPreview, targetPhase)) {
      await game.settings.set(MODULE_ID, "weatherPreview", null);
      warn("notification.currentPreviewStale");
    }

    await refreshStoredWeatherMetadata(currentWeather(), targetPhase);
    state.lastWorldTime = to;
    state.currentPhaseKey = targetPhase.key;
    state.sourceSignature = signature;
    state.lastCatchupCount = 0;
    await setState(state);
    return { active: true, boundaries: 0, phase: targetPhase, resolved: state.resolvedPhaseKey === targetPhase.key };
  }

  await game.settings.set(MODULE_ID, "weatherPreview", null);
  let weather = currentWeather();
  const fromPhase = await getCalendarForgePhaseInfo(from);

  if (state.resolvedPhaseKey !== fromPhase.key) {
    const base = state.phaseBaseWeather ?? weather;
    weather = await resolvePhaseAutomatically(base, fromPhase, "automatic-catchup");
    state.resolvedPhaseKey = fromPhase.key;
    state.currentPhaseKey = fromPhase.key;
    state.phaseBaseWeather = clone(base);
    await checkpoint(state, Math.min(to, fromPhase.nextBoundaryWorldTime));
  }

  let processed = 0;

  for (let index = 0; index < boundaries.length; index += 1) {
    const entered = boundaries[index];
    const isFinal = index === boundaries.length - 1;
    const queuedCandidate = state.queuedPreview?.phaseKey === entered.key ? state.queuedPreview : null;
    const queuedValid = queuedCandidate && queuedPreviewIsValid(queuedCandidate, weather, entered, signature);

    if (queuedCandidate && !queuedValid) {
      state.queuedPreview = null;
      warn("notification.queuedPreviewStale");
    }

    const baseForEntered = clone(weather);
    state.phaseBaseWeather = baseForEntered;
    state.currentPhaseKey = entered.key;

    if (isFinal && automationMode() === "manual") {
      await game.settings.set(
        MODULE_ID,
        "weatherPreview",
        queuedValid ? annotateWeather(queuedCandidate.weather, entered, "queued-preview") : null
      );
      state.queuedPreview = null;
      await refreshStoredWeatherMetadata(weather, entered);
      break;
    }

    if (queuedValid) {
      weather = await commitWeather(queuedCandidate.weather, entered, "queued-preview");
      state.queuedPreview = null;
    } else {
      weather = await resolvePhaseAutomatically(weather, entered, isFinal ? "automatic" : "automatic-catchup");
    }

    state.resolvedPhaseKey = entered.key;
    processed += 1;
    await checkpoint(state, entered.startWorldTime);
  }

  state.lastWorldTime = to;
  state.sourceSignature = signature;
  state.lastCatchupCount = processed;
  await setState(state);

  if (automationMode() === "manual" && state.resolvedPhaseKey !== targetPhase.key) {
    notify("notification.daypartReached", { daypart: game.i18n.localize(`${MODULE_ID}.time.${targetPhase.segment}`) });
  }

  return {
    active: true,
    boundaries: boundaries.length,
    phase: targetPhase,
    resolved: state.resolvedPhaseKey === targetPhase.key,
    catchupResolved: processed
  };
}

export async function getCalendarDrivenUiState() {
  if (effectiveCalendarSourceMode() !== "calendarForge") return { active: false };

  let state = getState();
  if (!state.initialized || state.sourceSignature !== sourceSignature() || currentWeather().weatherForgeCalendarSource !== "calendarForge") {
    state = await initializeCalendarDrivenWeather({ force: true });
  }

  const phase = await getCalendarForgePhaseInfo(game.time.worldTime);
  const resolved = state.resolvedPhaseKey === phase.key;
  let nextPhase = null;
  try { nextPhase = await getCalendarForgePhaseInfo(phase.nextBoundaryWorldTime); } catch (_) {}

  const queued = state.queuedPreview;
  const queuedStale = Boolean(
    queued?.weather
    && nextPhase
    && !queuedPreviewIsValid(queued, currentWeather(), nextPhase, sourceSignature())
  );

  return {
    active: true,
    phase,
    resolved,
    state,
    queuedPreview: queuedStale ? null : queued,
    queuedPreviewStale: queuedStale,
    nextPhase,
    automationMode: automationMode()
  };
}

export async function generateCurrentPhasePreview({ climateZone = null, allowExtreme = null, extremeFrequency = null, forceExtreme = false, extremeType = null } = {}) {
  const uiState = await getCalendarDrivenUiState();
  if (!uiState.active || uiState.resolved) return null;

  const base = uiState.state.phaseBaseWeather ?? currentWeather();
  const climateContext = await resolveEffectiveClimateContext({
    manualClimateZone: configuredManualClimateZone(base.climateZone ?? "temperate")
  });
  const settings = {
    ...generationSettings(base),
    climateZone: climateZone || climateContext.effectiveClimateZone,
    allowExtreme: allowExtreme ?? (game.settings.get(MODULE_ID, "allowExtreme") ?? true),
    extremeFrequency: extremeFrequency || game.settings.get(MODULE_ID, "extremeFrequency") || "normal",
    forceExtreme,
    extremeType
  };
  const preview = annotateWeatherWithClimateContext(
    annotateWeather(generateWeatherForTarget(base, uiState.phase.calendar, settings), uiState.phase, "manual-preview"),
    climateContext
  );
  await game.settings.set(MODULE_ID, "weatherPreview", preview);
  return preview;
}

export async function acceptCurrentPhasePreview() {
  const uiState = await getCalendarDrivenUiState();
  if (!uiState.active) return null;

  const preview = game.settings.get(MODULE_ID, "weatherPreview");
  if (!previewCompatibleWithPhase(preview, uiState.phase)) {
    if (preview) {
      await game.settings.set(MODULE_ID, "weatherPreview", null);
      warn("notification.currentPreviewStale");
    }
    return null;
  }

  const committed = await commitWeather(preview, uiState.phase, "manual");
  const state = getState();
  state.resolvedPhaseKey = uiState.phase.key;
  state.currentPhaseKey = uiState.phase.key;
  state.lastWorldTime = Number(game.time.worldTime);
  state.phaseBaseWeather = clone(committed);
  state.queuedPreview = null;
  await setState(state);
  await game.settings.set(MODULE_ID, "weatherPreview", null);
  return committed;
}

export async function prepareNextPhasePreview({ climateZone = null } = {}) {
  const uiState = await getCalendarDrivenUiState();
  if (!uiState.active || !uiState.resolved || !uiState.nextPhase) return null;

  const base = currentWeather();
  const requestedClimate = climateZone && CLIMATE_ZONES[climateZone] ? climateZone : null;
  const generated = await generateForPhase(
    base,
    uiState.nextPhase,
    "queued-preview",
    requestedClimate ? { climateZone: requestedClimate } : {}
  );
  const state = getState();
  state.queuedPreview = {
    phaseKey: uiState.nextPhase.key,
    targetWorldTime: uiState.nextPhase.startWorldTime,
    segment: uiState.nextPhase.segment,
    weather: generated,
    createdAt: Date.now(),
    baseFingerprint: weatherFingerprint(base),
    sourceSignature: sourceSignature(),
    targetContextSignature: phaseContextSignature(uiState.nextPhase)
  };
  await setState(state);
  return state.queuedPreview;
}

export async function clearQueuedPreview() {
  const state = getState();
  state.queuedPreview = null;
  await setState(state);
}

export async function resolveCurrentPhaseWithInitialWeather(climateZone = null) {
  const uiState = await getCalendarDrivenUiState();
  if (!uiState.active) return null;
  const climateContext = await resolveEffectiveClimateContext({
    manualClimateZone: configuredManualClimateZone(climateZone ?? currentWeather().climateZone ?? "temperate")
  });
  const { createInitialWeatherState } = await import("./weather-engine.js");
  const weather = annotateWeatherWithClimateContext(
    createInitialWeatherState(climateZone || climateContext.effectiveClimateZone, uiState.phase.calendar),
    climateContext
  );
  const committed = await commitWeather(weather, uiState.phase, "manual-reset", { history: false });
  const state = getState();
  state.currentPhaseKey = uiState.phase.key;
  state.resolvedPhaseKey = uiState.phase.key;
  state.phaseBaseWeather = clone(committed);
  state.queuedPreview = null;
  state.lastWorldTime = Number(game.time.worldTime);
  await setState(state);
  await game.settings.set(MODULE_ID, "weatherPreview", null);
  return committed;
}

export async function invalidateQueuedPreview() {
  const state = getState();
  if (!state.queuedPreview) return false;
  state.queuedPreview = null;
  await setState(state);
  return true;
}
