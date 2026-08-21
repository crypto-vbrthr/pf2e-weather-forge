import { MODULE_ID, CLIMATE_ZONES, TIME_SEGMENTS, WEEKDAYS, MONTHS, MONTH_LENGTHS, EXTREME_FREQUENCIES, defaultWeatherState, createInitialWeatherState, generateNextWeather } from "./weather-engine.js";
import { MOON_PHASES, applyCalendarToWeather, calendarFromFormData, extractCalendarFromWeather, getCalendarState, setCalendarState, advanceTimeSegment, rewindTimeSegment, advanceCalendarDate, normalizeCalendarState, adoptWeatherIntoInternalCalendarFallback } from "./calendar-engine.js";
import { HISTORY_LIMITS, appendWeatherHistory, clearWeatherHistory, getHistoryLimit, getWeatherHistory, historyDescriptorKey } from "./history-engine.js";
import { FORECAST_DAYS, defaultForecastState, forecastDescriptorKey, forecastDriverKey, generateForecast, generateForecastFromCalendars, getForecastState, setForecastState } from "./forecast-engine.js";
import { weatherForgeLocalize } from "./localization.js";
import {
  CALENDAR_SOURCE_MODES, DAYPART_AUTOMATION_MODES, DEFAULT_DAYPART_BOUNDARIES,
  effectiveCalendarSourceMode, configuredCalendarSourceMode, isCalendarForgeAvailable,
  listCalendarForgeRegions, listCalendarForgeMoons, normalizeDaypartBoundaries,
  getCalendarForgeApi, calendarForgeOptions, getCalendarForgeSnapshot
} from "./calendar-source.js";
import {
  getCalendarDrivenUiState, generateCurrentPhasePreview, acceptCurrentPhasePreview,
  prepareNextPhasePreview, resolveCurrentPhaseWithInitialWeather, initializeCalendarDrivenWeather,
  invalidateQueuedPreview, resetCalendarDrivenState
} from "./daypart-automation.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const TEMPLATE_LABEL_KEYS = [
  ["chat_defaultMode", "pf2e-weather-forge.chat.defaultMode"],
  ["chat_publishGM", "pf2e-weather-forge.chat.publishGM"],
  ["chat_publishPublic", "pf2e-weather-forge.chat.publishPublic"],
  ["chat_publishTitle", "pf2e-weather-forge.chat.publishTitle"],
  ["field_climateZone", "pf2e-weather-forge.field.climateZone"],
  ["field_cloudDensity", "pf2e-weather-forge.field.cloudDensity"],
  ["field_dailyMinMax", "pf2e-weather-forge.field.dailyMinMax"],
  ["field_dayOfMonth", "pf2e-weather-forge.field.dayOfMonth"],
  ["field_extremeWeather", "pf2e-weather-forge.field.extremeWeather"],
  ["settings_extremeFrequency", "pf2e-weather-forge.settings.extremeFrequency.name"],
  ["field_humidity", "pf2e-weather-forge.field.humidity"],
  ["field_month", "pf2e-weather-forge.field.month"],
  ["field_moonPhase", "pf2e-weather-forge.field.moonPhase"],
  ["field_precipitation", "pf2e-weather-forge.field.precipitation"],
  ["field_temperature", "pf2e-weather-forge.field.temperature"],
  ["field_timeSegment", "pf2e-weather-forge.field.timeSegment"],
  ["field_trend", "pf2e-weather-forge.field.trend"],
  ["field_weekday", "pf2e-weather-forge.field.weekday"],
  ["field_windStrength", "pf2e-weather-forge.field.windStrength"],
  ["field_year", "pf2e-weather-forge.field.year"],
  ["forecast_days_label", "pf2e-weather-forge.forecast.days.label"],
  ["forecast_empty", "pf2e-weather-forge.forecast.empty"],
  ["forecast_field_confidence", "pf2e-weather-forge.forecast.field.confidence"],
  ["forecast_field_driver", "pf2e-weather-forge.forecast.field.driver"],
  ["forecast_field_rainRisk", "pf2e-weather-forge.forecast.field.rainRisk"],
  ["forecast_field_stormRisk", "pf2e-weather-forge.forecast.field.stormRisk"],
  ["forecast_field_temperatureRange", "pf2e-weather-forge.forecast.field.temperatureRange"],
  ["forecast_field_trend", "pf2e-weather-forge.forecast.field.trend"],
  ["forecast_generate", "pf2e-weather-forge.forecast.generate"],
  ["forecast_hint", "pf2e-weather-forge.forecast.hint"],
  ["forecast_publishGM", "pf2e-weather-forge.forecast.publishGM"],
  ["forecast_title", "pf2e-weather-forge.forecast.title"],
  ["history_clear", "pf2e-weather-forge.history.clear"],
  ["history_empty", "pf2e-weather-forge.history.empty"],
  ["history_hint", "pf2e-weather-forge.history.hint"],
  ["history_title", "pf2e-weather-forge.history.title"],
  ["settings_historyLimit_name", "pf2e-weather-forge.settings.historyLimit.name"],
  ["settingsTab_calendarTitle", "pf2e-weather-forge.settingsTab.calendarTitle"],
  ["settingsTab_climateTitle", "pf2e-weather-forge.settingsTab.climateTitle"],
  ["settingsTab_outputTitle", "pf2e-weather-forge.settingsTab.outputTitle"],
  ["settingsTab_save", "pf2e-weather-forge.settingsTab.save"],
  ["tabs_forecast", "pf2e-weather-forge.tabs.forecast"],
  ["tabs_generator", "pf2e-weather-forge.tabs.generator"],
  ["tabs_history", "pf2e-weather-forge.tabs.history"],
  ["tabs_label", "pf2e-weather-forge.tabs.label"],
  ["tabs_settings", "pf2e-weather-forge.tabs.settings"],
  ["ui_accept", "pf2e-weather-forge.ui.accept"],
  ["ui_allowExtreme", "pf2e-weather-forge.ui.allowExtreme"],
  ["ui_climateZone", "pf2e-weather-forge.ui.climateZone"],
  ["ui_currentWeather", "pf2e-weather-forge.ui.currentWeather"],
  ["ui_extremeType", "pf2e-weather-forge.ui.extremeType"],
  ["ui_forceExtreme", "pf2e-weather-forge.ui.forceExtreme"],
  ["ui_generate", "pf2e-weather-forge.ui.generate"],
  ["ui_nextDay", "pf2e-weather-forge.ui.nextDay"],
  ["ui_nextTime", "pf2e-weather-forge.ui.nextTime"],
  ["ui_noPreview", "pf2e-weather-forge.ui.noPreview"],
  ["ui_preview", "pf2e-weather-forge.ui.preview"],
  ["ui_previousDay", "pf2e-weather-forge.ui.previousDay"],
  ["ui_previousTime", "pf2e-weather-forge.ui.previousTime"],
  ["ui_reset", "pf2e-weather-forge.ui.reset"],
  ["ui_saveCalendar", "pf2e-weather-forge.ui.saveCalendar"],
  ["ui_settingsMovedHint", "pf2e-weather-forge.ui.settingsMovedHint"],
  ["ui_weatherGeneration", "pf2e-weather-forge.ui.weatherGeneration"],
  ["calendarIntegration_title", "pf2e-weather-forge.calendarIntegration.title"],
  ["calendarIntegration_source", "pf2e-weather-forge.calendarIntegration.source"],
  ["calendarIntegration_region", "pf2e-weather-forge.calendarIntegration.region"],
  ["calendarIntegration_moon", "pf2e-weather-forge.calendarIntegration.moon"],
  ["calendarIntegration_mode", "pf2e-weather-forge.calendarIntegration.mode"],
  ["calendarIntegration_dayparts", "pf2e-weather-forge.calendarIntegration.dayparts"],
  ["calendarIntegration_active", "pf2e-weather-forge.calendarIntegration.active"],
  ["calendarIntegration_fallback", "pf2e-weather-forge.calendarIntegration.fallback"],
  ["calendarIntegration_currentOpen", "pf2e-weather-forge.calendarIntegration.currentOpen"],
  ["calendarIntegration_currentResolved", "pf2e-weather-forge.calendarIntegration.currentResolved"],
  ["calendarIntegration_prepareNext", "pf2e-weather-forge.calendarIntegration.prepareNext"],
  ["calendarIntegration_nextPrepared", "pf2e-weather-forge.calendarIntegration.nextPrepared"],
  ["calendarIntegration_nextPhase", "pf2e-weather-forge.calendarIntegration.nextPhase"],
  ["calendarIntegration_previewCurrent", "pf2e-weather-forge.calendarIntegration.previewCurrent"],
  ["calendarIntegration_previewNext", "pf2e-weather-forge.calendarIntegration.previewNext"],
  ["calendarIntegration_noCurrentPreview", "pf2e-weather-forge.calendarIntegration.noCurrentPreview"],
  ["calendarIntegration_noNextPreview", "pf2e-weather-forge.calendarIntegration.noNextPreview"],
  ["calendarIntegration_queuedHint", "pf2e-weather-forge.calendarIntegration.queuedHint"],
  ["calendarIntegration_timeOwned", "pf2e-weather-forge.calendarIntegration.timeOwned"],
  ["time_morning", "pf2e-weather-forge.time.morning"],
  ["time_noon", "pf2e-weather-forge.time.noon"],
  ["time_afternoon", "pf2e-weather-forge.time.afternoon"],
  ["time_evening", "pf2e-weather-forge.time.evening"],
  ["time_night", "pf2e-weather-forge.time.night"],
];

function buildTemplateLabels() {
  return Object.fromEntries(TEMPLATE_LABEL_KEYS.map(([name, key]) => [name, weatherForgeLocalize(MODULE_ID, key)]));
}

export class PF2eWeatherForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(foundry.utils.mergeObject({
      window: { title: game.i18n.localize(`${MODULE_ID}.app.title`) }
    }, options, { inplace: false }));
    this.activeTab = options.activeTab ?? "generator";
    try {
      const localizedTitle = game.i18n.localize(`${MODULE_ID}.app.title`);
      this.options.window.title = localizedTitle;
      if (this.window) this.window.title = localizedTitle;
    } catch (_) {}
  }

  static DEFAULT_OPTIONS = {
    id: "pf2e-weather-forge-app",
    tag: "form",
    window: {
      title: "PF2e Weather Forge",
      icon: "fa-solid fa-cloud-sun-rain",
      resizable: true
    },
    position: {
      width: 1180,
      height: "auto"
    },
    classes: ["pf2e-weather-forge"],
    actions: {
      generate: PF2eWeatherForgeApp.#onGenerate,
      accept: PF2eWeatherForgeApp.#onAccept,
      reset: PF2eWeatherForgeApp.#onReset,
      saveCalendar: PF2eWeatherForgeApp.#onSaveCalendar,
      nextTime: PF2eWeatherForgeApp.#onNextTime,
      previousTime: PF2eWeatherForgeApp.#onPreviousTime,
      nextDay: PF2eWeatherForgeApp.#onNextDay,
      previousDay: PF2eWeatherForgeApp.#onPreviousDay,
      clearHistory: PF2eWeatherForgeApp.#onClearHistory,
      saveSettings: PF2eWeatherForgeApp.#onSaveSettings,
      publishGM: PF2eWeatherForgeApp.#onPublishGM,
      publishPublic: PF2eWeatherForgeApp.#onPublishPublic,
      generateForecast: PF2eWeatherForgeApp.#onGenerateForecast,
      publishForecastGM: PF2eWeatherForgeApp.#onPublishForecastGM,
      prepareNextPreview: PF2eWeatherForgeApp.#onPrepareNextPreview
    }
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/weather-forge.hbs`
    }
  };

  async _prepareContext(options) {
    const storedCurrent = game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState();
    const integration = effectiveCalendarSourceMode() === "calendarForge" ? await getCalendarDrivenUiState() : { active: false };
    const calendar = integration.active ? integration.phase.calendar : await getCalendarState();
    const storedPreview = game.settings.get(MODULE_ID, "weatherPreview") ?? null;
    const current = integration.active ? { ...storedCurrent, ...calendar, timeSegment: integration.phase.segment } : applyCalendarToWeather(storedCurrent, calendar);
    const preview = storedPreview ? storedPreview : null;
    const queuedPreview = integration.active && integration.queuedPreview?.weather ? integration.queuedPreview.weather : null;
    const forecast = getForecastState();
    const labels = buildTemplateLabels();
    const preparedPreview = preview ? this.#prepareWeather(preview) : null;
    const preparedQueuedPreview = queuedPreview ? this.#prepareWeather(queuedPreview) : null;
    const previewDisplay = preparedPreview ?? preparedQueuedPreview;
    const previewIsQueued = !preparedPreview && Boolean(preparedQueuedPreview);
    const previewContextLabel = previewDisplay
      ? (previewIsQueued ? labels.calendarIntegration_previewNext : labels.calendarIntegration_previewCurrent)
      : "";
    const previewEmptyLabel = integration.active
      ? (integration.resolved ? labels.calendarIntegration_noNextPreview : labels.calendarIntegration_noCurrentPreview)
      : labels.ui_noPreview;

    const activeTab = ["generator", "forecast", "history", "settings"].includes(this.activeTab) ? this.activeTab : "generator";

    return {
      labels,
      activeTab,
      activeTabs: {
        generator: activeTab === "generator",
        forecast: activeTab === "forecast",
        history: activeTab === "history",
        settings: activeTab === "settings"
      },
      current: this.#prepareWeather(current),
      preview: preparedPreview,
      queuedPreview: preparedQueuedPreview,
      previewDisplay,
      previewIsQueued,
      previewContextLabel,
      previewEmptyLabel,
      calendar: this.#prepareCalendar(calendar),
      calendarIntegration: this.#prepareCalendarIntegration(integration, preview, queuedPreview),
      climateZones: Object.keys(CLIMATE_ZONES).map(key => ({
        key,
        label: game.i18n.localize(`${MODULE_ID}.climate.${key}`),
        selected: key === current.climateZone
      })),
      timeSegments: TIME_SEGMENTS.map(key => ({
        key,
        label: game.i18n.localize(`${MODULE_ID}.time.${key}`),
        selected: key === calendar.timeSegment
      })),
      weekdays: WEEKDAYS.map(key => ({
        key,
        label: game.i18n.localize(`${MODULE_ID}.weekday.${key}`),
        selected: key === calendar.weekday
      })),
      months: MONTHS.map(key => ({
        key,
        label: game.i18n.localize(`${MODULE_ID}.month.${key}`),
        max: MONTH_LENGTHS[key] ?? 30,
        selected: key === calendar.month
      })),
      extremeTypes: ["storm", "heatwave", "coldSnap", "fog", "blizzard"].map(key => ({
        key,
        label: game.i18n.localize(`${MODULE_ID}.extreme.${key}`)
      })),
      history: this.#prepareHistory(getWeatherHistory()),
      forecast: this.#prepareForecast(forecast),
      appSettings: this.#prepareSettings(current, integration)
    };
  }

  #prepareSettings(current, integration = { active: false }) {
    const configuredLimit = getHistoryLimit();
    const chatMode = game.settings.get(MODULE_ID, "chatOutputMode") ?? "gm";
    const allowExtreme = game.settings.get(MODULE_ID, "allowExtreme") ?? true;
    const extremeFrequency = String(game.settings.get(MODULE_ID, "extremeFrequency") ?? "normal");
    const forecastDays = String(game.settings.get(MODULE_ID, "forecastDays") ?? "3");
    const sourceMode = configuredCalendarSourceMode();
    const configuredRegion = String(game.settings.get(MODULE_ID, "calendarForgeRegionId") ?? "");
    const configuredMoon = String(game.settings.get(MODULE_ID, "calendarForgeMoonId") ?? "");
    const configuredAutomation = String(game.settings.get(MODULE_ID, "daypartAutomationMode") ?? "manual");
    const boundaries = normalizeDaypartBoundaries(game.settings.get(MODULE_ID, "daypartBoundaries") ?? DEFAULT_DAYPART_BOUNDARIES);
    const labelOf = (value, fallback) => {
      if (typeof value === "string") return value;
      if (value?.i18n) return game.i18n.localize(value.i18n);
      return value?.value ?? fallback;
    };
    return {
      allowExtreme,
      calendarForgeAvailable: isCalendarForgeAvailable(),
      calendarSourceModes: CALENDAR_SOURCE_MODES.map(key => ({ key, label: game.i18n.localize(`${MODULE_ID}.calendarIntegration.source.${key}`), selected: key === sourceMode })),
      calendarForgeRegions: [{ key: "", label: game.i18n.localize(`${MODULE_ID}.calendarIntegration.defaultRegion`), selected: !configuredRegion }, ...listCalendarForgeRegions().map(region => ({ key: region.id, label: labelOf(region.label, region.id), selected: region.id === configuredRegion }))],
      calendarForgeMoons: [{ key: "", label: game.i18n.localize(`${MODULE_ID}.calendarIntegration.defaultMoon`), selected: !configuredMoon }, ...listCalendarForgeMoons().map(moon => ({ key: moon.id, label: labelOf(moon.label, moon.id), selected: moon.id === configuredMoon }))],
      daypartAutomationModes: DAYPART_AUTOMATION_MODES.map(key => ({ key, label: game.i18n.localize(`${MODULE_ID}.calendarIntegration.automation.${key}`), selected: key === configuredAutomation })),
      daypartBoundaries: boundaries,
      extremeFrequencies: EXTREME_FREQUENCIES.map(key => ({
        key,
        label: game.i18n.localize(`${MODULE_ID}.settings.extremeFrequency.${key}`),
        selected: key === extremeFrequency
      })),
      forecastDays: FORECAST_DAYS.map(key => ({
        key,
        label: game.i18n.localize(`${MODULE_ID}.forecast.days.${key}`),
        selected: key === forecastDays
      })),
      chatModes: ["gm", "public", "ask"].map(key => ({
        key,
        label: game.i18n.localize(`${MODULE_ID}.chat.mode.${key}`),
        selected: key === chatMode
      })),
      historyLimits: HISTORY_LIMITS.map(key => ({
        key,
        label: game.i18n.localize(`${MODULE_ID}.settings.historyLimit.${key}`),
        selected: key === configuredLimit
      })),
      currentClimateZone: current.climateZone
    };
  }


  #prepareCalendarIntegration(integration, preview, queuedPreview) {
    if (!integration?.active) {
      return { active: false, available: isCalendarForgeAvailable(), effectiveSource: "internal" };
    }
    const phase = integration.phase;
    const next = integration.nextPhase;
    return {
      active: true,
      available: true,
      effectiveSource: "calendarForge",
      resolved: Boolean(integration.resolved),
      canGenerateCurrent: !integration.resolved,
      canAcceptCurrent: !integration.resolved && Boolean(preview),
      canPrepareNext: Boolean(integration.resolved && next),
      automationMode: integration.automationMode,
      currentSegmentLabel: game.i18n.localize(`${MODULE_ID}.time.${phase.segment}`),
      nextSegmentLabel: next ? game.i18n.localize(`${MODULE_ID}.time.${next.segment}`) : "",
      nextTimeLabel: next?.calendar?.formattedTime ?? "",
      queued: Boolean(queuedPreview),
      queuedSegmentLabel: queuedPreview ? game.i18n.localize(`${MODULE_ID}.time.${queuedPreview.timeSegment}`) : ""
    };
  }


  #prepareForecast(forecast) {
    const entries = forecast?.entries ?? [];
    return {
      hasEntries: entries.length > 0,
      days: forecast?.days ?? 3,
      generatedFrom: forecast?.generatedFrom ?? null,
      entries: entries.map(entry => ({
        ...entry,
        weekdayLabel: entry.calendar?.calendarLabels?.weekday || game.i18n.localize(`${MODULE_ID}.weekday.${entry.calendar?.weekday}`),
        monthLabel: entry.calendar?.calendarLabels?.month || game.i18n.localize(`${MODULE_ID}.month.${entry.calendar?.month}`),
        seasonLabel: entry.calendar?.calendarLabels?.season || game.i18n.localize(`${MODULE_ID}.season.${entry.calendar?.season}`),
        trendLabel: game.i18n.localize(`${MODULE_ID}.trend.${entry.trend ?? "stable"}`),
        weatherLabel: game.i18n.localize(`${MODULE_ID}.forecast.weather.${forecastDescriptorKey(entry)}`),
        driverLabel: game.i18n.localize(`${MODULE_ID}.forecast.driver.${forecastDriverKey(entry)}`),
        temperatureRange: `${entry.minTemp} – ${entry.maxTemp} °C`,
        rainRiskLabel: `${entry.rainRisk} %`,
        stormRiskLabel: `${entry.stormRisk} %`,
        confidenceLabel: `${entry.confidence} %`,
        gmHint: game.i18n.localize(`${MODULE_ID}.forecast.hint.${forecastDriverKey(entry)}`)
      }))
    };
  }


  #prepareHistory(entries) {
    const groups = new Map();
    for (const entry of entries ?? []) {
      const dateKey = entry.dateKey ?? `${entry.year}-${entry.month}-${entry.dayOfMonth}`;
      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          dateKey,
          year: entry.year,
          month: entry.month,
          dayOfMonth: entry.dayOfMonth,
          weekday: entry.weekday,
          season: entry.season,
          moonPhase: entry.moonPhase,
          formattedDate: entry.formattedDate ?? null,
          calendarLabels: entry.calendarLabels ?? null,
          entries: []
        });
      }
      groups.get(dateKey).entries.push(this.#prepareHistoryEntry(entry));
    }

    const prepared = [...groups.values()].reverse().map(group => {
      const latest = group.entries[group.entries.length - 1];
      return {
        ...group,
        displayDate: group.formattedDate || null,
        weekdayLabel: group.calendarLabels?.weekday || game.i18n.localize(`${MODULE_ID}.weekday.${group.weekday}`),
        monthLabel: group.calendarLabels?.month || game.i18n.localize(`${MODULE_ID}.month.${group.month}`),
        seasonLabel: group.calendarLabels?.season || game.i18n.localize(`${MODULE_ID}.season.${group.season}`),
        moonPhaseLabel: group.calendarLabels?.moonPhase || game.i18n.localize(`${MODULE_ID}.moon.${group.moonPhase}`),
        summary: latest
          ? `${latest.precipitationLabel}, ${latest.temperature} °C, ${latest.windStrengthDescription}`
          : game.i18n.localize(`${MODULE_ID}.history.noEntries`),
        entries: [...group.entries].reverse()
      };
    });

    return {
      count: entries?.length ?? 0,
      hasEntries: (entries?.length ?? 0) > 0,
      groups: prepared
    };
  }

  #prepareHistoryEntry(entry) {
    const humidityDescription = game.i18n.localize(`${MODULE_ID}.humidity.${historyDescriptorKey("humidity", entry.humidity ?? 0)}`);
    const cloudDensityDescription = game.i18n.localize(`${MODULE_ID}.cloudDensity.${historyDescriptorKey("cloudDensity", entry.cloudDensity ?? 0)}`);
    const windStrengthDescription = game.i18n.localize(`${MODULE_ID}.windStrength.${historyDescriptorKey("windStrength", entry.windStrength ?? 0)}`);
    return {
      ...entry,
      timeSegmentLabel: game.i18n.localize(`${MODULE_ID}.time.${entry.timeSegment}`),
      climateZoneLabel: game.i18n.localize(`${MODULE_ID}.climate.${entry.climateZone}`),
      precipitationLabel: game.i18n.localize(`${MODULE_ID}.precipitation.${entry.precipitation}`),
      humidityDescription,
      cloudDensityDescription,
      windStrengthDescription,
      trendLabel: game.i18n.localize(`${MODULE_ID}.trend.${entry.trend ?? "stable"}`),
      description: game.i18n.localize(`${MODULE_ID}.${entry.descriptionKey ?? "description.clearMild"}`),
      extremeLabel: entry.extremeWeather
        ? `${game.i18n.localize(`${MODULE_ID}.extreme.${entry.extremeWeather.type}`)} · ${game.i18n.localize(`${MODULE_ID}.extremePhase.${entry.extremeWeather.phase ?? "active"}`)}`
        : game.i18n.localize(`${MODULE_ID}.extreme.none`),
      humidityText: `${entry.humidity} % · ${humidityDescription}`,
      cloudDensityText: `${entry.cloudDensity} % · ${cloudDensityDescription}`,
      windStrengthText: `${entry.windStrength} · ${windStrengthDescription}`
    };
  }

  #prepareCalendar(calendar) {
    const labels = calendar?.calendarLabels ?? {};
    return {
      ...calendar,
      timeSegmentLabel: game.i18n.localize(`${MODULE_ID}.time.${calendar.timeSegment}`),
      weekdayLabel: labels.weekday || calendar.weekdayLabel || game.i18n.localize(`${MODULE_ID}.weekday.${calendar.weekday}`),
      monthLabel: labels.month || calendar.monthLabel || game.i18n.localize(`${MODULE_ID}.month.${calendar.month}`),
      moonPhaseLabel: labels.moonPhase || calendar.moonPhaseLabel || game.i18n.localize(`${MODULE_ID}.moon.${calendar.moonPhase}`),
      seasonLabel: labels.season || calendar.seasonLabel || game.i18n.localize(`${MODULE_ID}.season.${calendar.season}`)
    };
  }

  #descriptorKey(type, value) {
    if (type === "humidity") {
      if (value < 30) return "dry";
      if (value < 60) return "normal";
      if (value < 80) return "humid";
      return "veryHumid";
    }
    if (type === "cloudDensity") {
      if (value < 20) return "clear";
      if (value < 45) return "scattered";
      if (value < 75) return "cloudy";
      return "overcast";
    }
    if (type === "windStrength") {
      if (value <= 0) return "calm";
      if (value <= 2) return "breeze";
      if (value <= 5) return "windy";
      if (value <= 8) return "strong";
      return "violent";
    }
    return "normal";
  }

  #prepareWeather(weather) {
    return {
      ...weather,
      timeSegmentLabel: game.i18n.localize(`${MODULE_ID}.time.${weather.timeSegment}`),
      climateZoneLabel: game.i18n.localize(`${MODULE_ID}.climate.${weather.climateZone}`),
      precipitationLabel: game.i18n.localize(`${MODULE_ID}.precipitation.${weather.precipitation}`),
      humidityDescription: game.i18n.localize(`${MODULE_ID}.humidity.${this.#descriptorKey("humidity", weather.humidity ?? 0)}`),
      cloudDensityDescription: game.i18n.localize(`${MODULE_ID}.cloudDensity.${this.#descriptorKey("cloudDensity", weather.cloudDensity ?? 0)}`),
      windStrengthDescription: game.i18n.localize(`${MODULE_ID}.windStrength.${this.#descriptorKey("windStrength", weather.windStrength ?? 0)}`),
      weekdayLabel: weather.calendarLabels?.weekday || weather.weekdayLabel || game.i18n.localize(`${MODULE_ID}.weekday.${weather.weekday}`),
      monthLabel: weather.calendarLabels?.month || weather.monthLabel || game.i18n.localize(`${MODULE_ID}.month.${weather.month}`),
      moonPhaseLabel: weather.calendarLabels?.moonPhase || weather.moonPhaseLabel || game.i18n.localize(`${MODULE_ID}.moon.${weather.moonPhase}`),
      seasonLabel: weather.calendarLabels?.season || weather.seasonLabel || game.i18n.localize(`${MODULE_ID}.season.${weather.season}`),
      description: game.i18n.localize(`${MODULE_ID}.${weather.descriptionKey}`),
      dailyMinTemp: weather.dailyProfile?.minTemp ?? weather.temperature,
      dailyMaxTemp: weather.dailyProfile?.maxTemp ?? weather.temperature,
      trendLabel: game.i18n.localize(`${MODULE_ID}.trend.${weather.dailyProfile?.trend ?? "stable"}`),
      extremeLabel: weather.extremeWeather
        ? `${game.i18n.localize(`${MODULE_ID}.extreme.${weather.extremeWeather.type}`)} · ${game.i18n.localize(`${MODULE_ID}.extremePhase.${weather.extremeWeather.phase ?? "active"}`)} · ${weather.extremeWeather.remainingSegments ?? "?"}`
        : game.i18n.localize(`${MODULE_ID}.extreme.none`)
    };
  }

  static #rememberActiveTab(app, target, fallback = null) {
    const form = target?.closest?.("form") ?? app?.element ?? null;
    const checked = form?.querySelector?.('input[name="weatherForgeTab"]:checked');
    const tab = checked?.value ?? fallback ?? app?.activeTab ?? "generator";
    app.activeTab = ["generator", "forecast", "history", "settings"].includes(tab) ? tab : "generator";
  }

  static async #syncCalendarToWeather(calendar) {
    const current = game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState();
    await game.settings.set(MODULE_ID, "weatherState", applyCalendarToWeather(current, calendar));
    await game.settings.set(MODULE_ID, "weatherPreview", null);
  }

  static async #onGenerate(event, target) {
    event.preventDefault();
    PF2eWeatherForgeApp.#rememberActiveTab(this, target, "generator");
    const form = target.closest("form") ?? this.element;
    const fd = new FormData(form);
    await PF2eWeatherForgeApp.#persistUiSettings(fd);
    if (effectiveCalendarSourceMode() === "calendarForge") {
      await generateCurrentPhasePreview({
        climateZone: fd.get("climateZone"),
        allowExtreme: fd.get("allowExtreme") === "on",
        extremeFrequency: fd.get("extremeFrequency") || game.settings.get(MODULE_ID, "extremeFrequency") || "normal",
        forceExtreme: fd.get("forceExtreme") === "on",
        extremeType: fd.get("extremeType")
      });
    } else {
      const calendar = await setCalendarState(calendarFromFormData(fd));
      const current = applyCalendarToWeather(game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState(), calendar);
      const preview = generateNextWeather(current, {
        climateZone: fd.get("climateZone"),
        allowExtreme: fd.get("allowExtreme") === "on",
        extremeFrequency: fd.get("extremeFrequency") || game.settings.get(MODULE_ID, "extremeFrequency") || "normal",
        forceExtreme: fd.get("forceExtreme") === "on",
        extremeType: fd.get("extremeType"),
        forecast: getForecastState()
      });
      await game.settings.set(MODULE_ID, "weatherPreview", preview);
    }
    this.render();
  }

  static async #onAccept(event) {
    event.preventDefault();
    PF2eWeatherForgeApp.#rememberActiveTab(this, null, "generator");
    const preview = game.settings.get(MODULE_ID, "weatherPreview");
    if (!preview) return;
    if (effectiveCalendarSourceMode() === "calendarForge") {
      const committed = await acceptCurrentPhasePreview();
      if (!committed) return;
    } else {
      await game.settings.set(MODULE_ID, "weatherState", preview);
      await appendWeatherHistory(preview);
      await setCalendarState(extractCalendarFromWeather(preview));
      await game.settings.set(MODULE_ID, "weatherPreview", null);
    }
    ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notification.weatherAccepted`));
    this.render();
  }

  static async #onReset(event, target) {
    event.preventDefault();
    PF2eWeatherForgeApp.#rememberActiveTab(this, target, "generator");
    const form = target.closest("form") ?? this.element;
    const fd = new FormData(form);
    const climateZone = fd.get("climateZone") || "temperate";
    await PF2eWeatherForgeApp.#persistUiSettings(fd);
    if (effectiveCalendarSourceMode() === "calendarForge") {
      await resolveCurrentPhaseWithInitialWeather(climateZone);
    } else {
      const calendar = await setCalendarState(calendarFromFormData(fd));
      await game.settings.set(MODULE_ID, "weatherState", applyCalendarToWeather(createInitialWeatherState(climateZone, calendar), calendar));
      await game.settings.set(MODULE_ID, "weatherPreview", null);
    }
    ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notification.weatherReset`));
    this.render();
  }

  static async #onSaveCalendar(event, target) {
    event.preventDefault();
    PF2eWeatherForgeApp.#rememberActiveTab(this, target, "settings");
    const form = target.closest("form") ?? this.element;
    const fd = new FormData(form);
    if (effectiveCalendarSourceMode() === "calendarForge") return;
    const calendar = calendarFromFormData(fd);
    await setCalendarState(calendar);
    await PF2eWeatherForgeApp.#persistUiSettings(fd);
    await game.settings.set(MODULE_ID, "weatherPreview", null);
    ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notification.calendarSaved`));
    this.render();
  }

  static #calendarFromCurrentForm(target, app) {
    const form = target?.closest?.("form") ?? app.element;
    return calendarFromFormData(new FormData(form));
  }

  static async #onNextTime(event, target) {
    event.preventDefault();
    PF2eWeatherForgeApp.#rememberActiveTab(this, target, "settings");
    if (effectiveCalendarSourceMode() === "calendarForge") return;
    const form = target?.closest?.("form") ?? this.element;
    await PF2eWeatherForgeApp.#persistUiSettings(new FormData(form));
    const baseCalendar = PF2eWeatherForgeApp.#calendarFromCurrentForm(target, this);
    const calendar = advanceTimeSegment(baseCalendar);
    await setCalendarState(calendar);
    await PF2eWeatherForgeApp.#syncCalendarToWeather(calendar);
    this.render();
  }

  static async #onPreviousTime(event, target) {
    event.preventDefault();
    PF2eWeatherForgeApp.#rememberActiveTab(this, target, "settings");
    if (effectiveCalendarSourceMode() === "calendarForge") return;
    const form = target?.closest?.("form") ?? this.element;
    await PF2eWeatherForgeApp.#persistUiSettings(new FormData(form));
    const baseCalendar = PF2eWeatherForgeApp.#calendarFromCurrentForm(target, this);
    const calendar = rewindTimeSegment(baseCalendar);
    await setCalendarState(calendar);
    await PF2eWeatherForgeApp.#syncCalendarToWeather(calendar);
    this.render();
  }

  static async #onNextDay(event, target) {
    event.preventDefault();
    PF2eWeatherForgeApp.#rememberActiveTab(this, target, "settings");
    if (effectiveCalendarSourceMode() === "calendarForge") return;
    const form = target?.closest?.("form") ?? this.element;
    await PF2eWeatherForgeApp.#persistUiSettings(new FormData(form));
    const baseCalendar = PF2eWeatherForgeApp.#calendarFromCurrentForm(target, this);
    const calendar = advanceCalendarDate(baseCalendar, 1);
    await setCalendarState(calendar);
    await PF2eWeatherForgeApp.#syncCalendarToWeather(calendar);
    this.render();
  }

  static async #onPreviousDay(event, target) {
    event.preventDefault();
    PF2eWeatherForgeApp.#rememberActiveTab(this, target, "settings");
    if (effectiveCalendarSourceMode() === "calendarForge") return;
    const form = target?.closest?.("form") ?? this.element;
    await PF2eWeatherForgeApp.#persistUiSettings(new FormData(form));
    const baseCalendar = PF2eWeatherForgeApp.#calendarFromCurrentForm(target, this);
    const calendar = advanceCalendarDate(baseCalendar, -1);
    await setCalendarState(calendar);
    await PF2eWeatherForgeApp.#syncCalendarToWeather(calendar);
    this.render();
  }

  static async #onClearHistory(event, target) {
    event.preventDefault();
    PF2eWeatherForgeApp.#rememberActiveTab(this, target, "history");
    const form = target?.closest?.("form") ?? this.element;
    if (form) await PF2eWeatherForgeApp.#persistUiSettings(new FormData(form));
    await clearWeatherHistory();
    ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notification.historyCleared`));
    this.render();
  }

  static async #persistUiSettings(fd) {
    if (!fd) return;

    const climateZone = String(fd.get("climateZone") ?? "");
    if (Object.hasOwn(CLIMATE_ZONES, climateZone)) {
      const current = game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState();
      if ((current.climateZone ?? "temperate") !== climateZone) {
        await game.settings.set(MODULE_ID, "weatherState", { ...current, climateZone });
        await game.settings.set(MODULE_ID, "weatherPreview", null);
        if (effectiveCalendarSourceMode() === "calendarForge") await invalidateQueuedPreview();
      }
    }

    if (fd.has("calendarSourceMode")) {
      const source = String(fd.get("calendarSourceMode") ?? "auto");
      if (CALENDAR_SOURCE_MODES.includes(source)) await game.settings.set(MODULE_ID, "calendarSourceMode", source);
    }
    if (fd.has("calendarForgeRegionId")) await game.settings.set(MODULE_ID, "calendarForgeRegionId", String(fd.get("calendarForgeRegionId") ?? ""));
    if (fd.has("calendarForgeMoonId")) await game.settings.set(MODULE_ID, "calendarForgeMoonId", String(fd.get("calendarForgeMoonId") ?? ""));
    if (fd.has("daypartAutomationMode")) {
      const mode = String(fd.get("daypartAutomationMode") ?? "manual");
      if (DAYPART_AUTOMATION_MODES.includes(mode)) await game.settings.set(MODULE_ID, "daypartAutomationMode", mode);
    }
    if (fd.has("daypartMorning")) {
      const boundaries = normalizeDaypartBoundaries({
        morning: Number(fd.get("daypartMorning")), noon: Number(fd.get("daypartNoon")), afternoon: Number(fd.get("daypartAfternoon")),
        evening: Number(fd.get("daypartEvening")), night: Number(fd.get("daypartNight"))
      });
      await game.settings.set(MODULE_ID, "daypartBoundaries", boundaries);
    }

    const historyLimit = String(fd.get("historyLimit") ?? getHistoryLimit());
    if (HISTORY_LIMITS.includes(historyLimit)) await game.settings.set(MODULE_ID, "historyLimit", historyLimit);

    const chatOutputMode = String(fd.get("chatOutputMode") ?? game.settings.get(MODULE_ID, "chatOutputMode") ?? "gm");
    if (["gm", "public", "ask"].includes(chatOutputMode)) await game.settings.set(MODULE_ID, "chatOutputMode", chatOutputMode);

    const allowExtremeValue = fd.has("allowExtreme") ? fd.get("allowExtreme") === "on" : (game.settings.get(MODULE_ID, "allowExtreme") ?? true);
    await game.settings.set(MODULE_ID, "allowExtreme", allowExtremeValue);

    const extremeFrequency = String(fd.get("extremeFrequency") ?? game.settings.get(MODULE_ID, "extremeFrequency") ?? "normal");
    if (EXTREME_FREQUENCIES.includes(extremeFrequency)) await game.settings.set(MODULE_ID, "extremeFrequency", extremeFrequency);

    const forecastDays = String(fd.get("forecastDays") ?? game.settings.get(MODULE_ID, "forecastDays") ?? "3");
    if (FORECAST_DAYS.includes(forecastDays)) await game.settings.set(MODULE_ID, "forecastDays", forecastDays);
  }

  static async #onSaveSettings(event, target) {
    event.preventDefault();
    PF2eWeatherForgeApp.#rememberActiveTab(this, target, "settings");
    const form = target.closest("form") ?? this.element;
    const fd = new FormData(form);

    const previousEffectiveSource = effectiveCalendarSourceMode();
    await PF2eWeatherForgeApp.#persistUiSettings(fd);
    const nextEffectiveSource = effectiveCalendarSourceMode();

    if (previousEffectiveSource !== nextEffectiveSource) {
      await game.settings.set(MODULE_ID, "weatherPreview", null);

      if (nextEffectiveSource === "calendarForge") {
        await resetCalendarDrivenState();
        await initializeCalendarDrivenWeather({ force: true });
      } else {
        const current = game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState();
        await resetCalendarDrivenState();
        const adopted = await adoptWeatherIntoInternalCalendarFallback(current);
        if (!adopted && fd.has("calendarMonth")) await setCalendarState(calendarFromFormData(fd));
      }
    } else if (nextEffectiveSource === "calendarForge") {
      await initializeCalendarDrivenWeather();
    } else if (fd.has("calendarMonth")) {
      await setCalendarState(calendarFromFormData(fd));
    }

    ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notification.settingsSaved`));
    this.render();
  }

  static async #onPrepareNextPreview(event, target) {
    event.preventDefault();
    PF2eWeatherForgeApp.#rememberActiveTab(this, target, "generator");
    const form = target.closest("form") ?? this.element;
    const fd = new FormData(form);
    await PF2eWeatherForgeApp.#persistUiSettings(fd);
    const queued = await prepareNextPhasePreview({ climateZone: fd.get("climateZone") });
    if (queued) ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notification.nextPreviewPrepared`));
    this.render();
  }

  static async #onPublishGM(event) {
    event.preventDefault();
    await PF2eWeatherForgeApp.#publishWeather("gm");
  }

  static async #onPublishPublic(event) {
    event.preventDefault();
    await PF2eWeatherForgeApp.#publishWeather("public");
  }


  static async #onGenerateForecast(event, target) {
    event.preventDefault();
    PF2eWeatherForgeApp.#rememberActiveTab(this, target, "forecast");
    const form = target.closest("form") ?? this.element;
    const fd = new FormData(form);
    await PF2eWeatherForgeApp.#persistUiSettings(fd);
    const days = Number(fd.get("forecastDays") ?? game.settings.get(MODULE_ID, "forecastDays") ?? 3);
    let forecast;
    if (effectiveCalendarSourceMode() === "calendarForge") {
      const api = getCalendarForgeApi();
      const baseContext = await api.getTemporalContext(calendarForgeOptions());
      const t = baseContext.raw.calendar.time ?? {};
      const secondsPerDay = Number(t.secondsPerMinute ?? 60) * Number(t.minutesPerHour ?? 60) * Number(t.hoursPerDay ?? 24);
      const currentCalendar = await getCalendarForgeSnapshot({ fallbackWeather: game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState() });
      const current = { ...(game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState()), ...currentCalendar };
      const calendars = [];
      for (let day = 1; day <= days; day += 1) calendars.push(await getCalendarForgeSnapshot({ worldTime: Number(game.time.worldTime) + day * secondsPerDay, fallbackWeather: current }));
      forecast = generateForecastFromCalendars(current, calendars);
    } else {
      const calendar = await setCalendarState(calendarFromFormData(fd));
      const current = applyCalendarToWeather(game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState(), calendar);
      forecast = generateForecast(current, days);
    }
    await setForecastState(forecast);
    ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notification.forecastGenerated`));
    this.render();
  }

  static async #onPublishForecastGM(event) {
    event.preventDefault();
    const forecast = getForecastState();
    if (!forecast?.entries?.length) return ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notification.noForecast`));
    const content = PF2eWeatherForgeApp.#buildForecastChatCard(forecast);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: game.i18n.localize(`${MODULE_ID}.chat.speaker`) }),
      content,
      whisper: ChatMessage.getWhisperRecipients("GM").map(user => user.id)
    });
  }

  static async #publishWeather(mode = "gm") {
    let weather = game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState();
    if (effectiveCalendarSourceMode() === "calendarForge") {
      try {
        const integration = await getCalendarDrivenUiState();
        if (integration?.active) weather = { ...weather, ...integration.phase.calendar, timeSegment: integration.phase.segment };
      } catch (_) {}
    }
    const prepared = PF2eWeatherForgeApp.#prepareWeatherForChat(weather);
    const content = PF2eWeatherForgeApp.#buildWeatherChatCard(prepared, mode);
    const messageData = {
      speaker: ChatMessage.getSpeaker({ alias: game.i18n.localize(`${MODULE_ID}.chat.speaker`) }),
      content
    };
    if (mode === "gm") {
      messageData.whisper = ChatMessage.getWhisperRecipients("GM").map(user => user.id);
    }
    await ChatMessage.create(messageData);
  }

  static #chatDescriptorKey(type, value) {
    if (type === "humidity") {
      if (value < 30) return "dry";
      if (value < 60) return "normal";
      if (value < 80) return "humid";
      return "veryHumid";
    }
    if (type === "cloudDensity") {
      if (value < 20) return "clear";
      if (value < 45) return "scattered";
      if (value < 75) return "cloudy";
      return "overcast";
    }
    if (type === "windStrength") {
      if (value <= 0) return "calm";
      if (value <= 2) return "breeze";
      if (value <= 5) return "windy";
      if (value <= 8) return "strong";
      return "violent";
    }
    return "normal";
  }

  static #prepareWeatherForChat(weather) {
    const esc = foundry.utils.escapeHTML;
    const extreme = weather.extremeWeather
      ? `${game.i18n.localize(`${MODULE_ID}.extreme.${weather.extremeWeather.type}`)} · ${game.i18n.localize(`${MODULE_ID}.extremePhase.${weather.extremeWeather.phase ?? "active"}`)} · ${weather.extremeWeather.remainingSegments ?? "?"}`
      : game.i18n.localize(`${MODULE_ID}.extreme.none`);
    return {
      title: game.i18n.localize(`${MODULE_ID}.chat.title`),
      date: weather.formattedDate || `${weather.calendarLabels?.weekday || game.i18n.localize(`${MODULE_ID}.weekday.${weather.weekday}`)}, ${weather.dayOfMonth}. ${weather.calendarLabels?.month || game.i18n.localize(`${MODULE_ID}.month.${weather.month}`)} ${weather.year}`,
      time: game.i18n.localize(`${MODULE_ID}.time.${weather.timeSegment}`),
      season: weather.calendarLabels?.season || game.i18n.localize(`${MODULE_ID}.season.${weather.season}`),
      moon: weather.calendarLabels?.moonPhase || game.i18n.localize(`${MODULE_ID}.moon.${weather.moonPhase}`),
      description: game.i18n.localize(`${MODULE_ID}.${weather.descriptionKey ?? "description.clearMild"}`),
      temperature: `${weather.temperature} °C`,
      dailyMinMax: `${weather.dailyProfile?.minTemp ?? weather.temperature} / ${weather.dailyProfile?.maxTemp ?? weather.temperature} °C`,
      trend: game.i18n.localize(`${MODULE_ID}.trend.${weather.dailyProfile?.trend ?? "stable"}`),
      precipitation: game.i18n.localize(`${MODULE_ID}.precipitation.${weather.precipitation}`),
      humidity: `${weather.humidity} % · ${game.i18n.localize(`${MODULE_ID}.humidity.${PF2eWeatherForgeApp.#chatDescriptorKey("humidity", weather.humidity ?? 0)}`)}`,
      cloudDensity: `${weather.cloudDensity} % · ${game.i18n.localize(`${MODULE_ID}.cloudDensity.${PF2eWeatherForgeApp.#chatDescriptorKey("cloudDensity", weather.cloudDensity ?? 0)}`)}`,
      windStrength: `${weather.windStrength} · ${game.i18n.localize(`${MODULE_ID}.windStrength.${PF2eWeatherForgeApp.#chatDescriptorKey("windStrength", weather.windStrength ?? 0)}`)}`,
      climate: game.i18n.localize(`${MODULE_ID}.climate.${weather.climateZone}`),
      extreme,
      esc
    };
  }

  static #buildWeatherChatCard(w, mode = "gm") {
    const e = foundry.utils.escapeHTML;
    const rows = [
      [game.i18n.localize(`${MODULE_ID}.field.temperature`), w.temperature],
      ...(mode === "gm" ? [[game.i18n.localize(`${MODULE_ID}.field.dailyMinMax`), w.dailyMinMax]] : []),
      [game.i18n.localize(`${MODULE_ID}.field.precipitation`), w.precipitation],
      [game.i18n.localize(`${MODULE_ID}.field.humidity`), w.humidity],
      [game.i18n.localize(`${MODULE_ID}.field.cloudDensity`), w.cloudDensity],
      [game.i18n.localize(`${MODULE_ID}.field.windStrength`), w.windStrength],
      [game.i18n.localize(`${MODULE_ID}.field.trend`), w.trend],
      [game.i18n.localize(`${MODULE_ID}.field.climateZone`), w.climate],
      [game.i18n.localize(`${MODULE_ID}.field.moonPhase`), w.moon],
      [game.i18n.localize(`${MODULE_ID}.field.extremeWeather`), w.extreme]
    ].map(([label, value]) => `<dt>${e(label)}</dt><dd>${e(String(value))}</dd>`).join("");

    return `
      <article class="pf2e-weather-forge-chat-card">
        <h2><i class="fas fa-cloud-sun-rain"></i> ${e(w.title)}</h2>
        <div class="weather-chat-meta"><strong>${e(w.date)}</strong><br>${e(w.time)} · ${e(w.season)}</div>
        <p class="weather-chat-description">${e(w.description)}</p>
        <dl>${rows}</dl>
      </article>`;
  }


  static #buildForecastChatCard(forecast) {
    const e = foundry.utils.escapeHTML;
    const title = game.i18n.localize(`${MODULE_ID}.forecast.chatTitle`);
    const rows = (forecast.entries ?? []).map(entry => {
      const date = entry.calendar?.formattedDate || `${entry.calendar?.calendarLabels?.weekday || game.i18n.localize(`${MODULE_ID}.weekday.${entry.calendar?.weekday}`)}, ${entry.calendar?.dayOfMonth}. ${entry.calendar?.calendarLabels?.month || game.i18n.localize(`${MODULE_ID}.month.${entry.calendar?.month}`)} ${entry.calendar?.year}`;
      const weather = game.i18n.localize(`${MODULE_ID}.forecast.weather.${forecastDescriptorKey(entry)}`);
      const driver = game.i18n.localize(`${MODULE_ID}.forecast.driver.${forecastDriverKey(entry)}`);
      const trend = game.i18n.localize(`${MODULE_ID}.trend.${entry.trend ?? "stable"}`);
      const hint = game.i18n.localize(`${MODULE_ID}.forecast.hint.${forecastDriverKey(entry)}`);
      return `<article class="forecast-chat-entry">
        <h3>${e(date)}</h3>
        <dl>
          <dt>${e(game.i18n.localize(`${MODULE_ID}.forecast.field.expected`))}</dt><dd>${e(weather)}</dd>
          <dt>${e(game.i18n.localize(`${MODULE_ID}.forecast.field.temperatureRange`))}</dt><dd>${e(`${entry.minTemp} – ${entry.maxTemp} °C`)}</dd>
          <dt>${e(game.i18n.localize(`${MODULE_ID}.forecast.field.rainRisk`))}</dt><dd>${e(`${entry.rainRisk} %`)}</dd>
          <dt>${e(game.i18n.localize(`${MODULE_ID}.forecast.field.stormRisk`))}</dt><dd>${e(`${entry.stormRisk} %`)}</dd>
          <dt>${e(game.i18n.localize(`${MODULE_ID}.forecast.field.confidence`))}</dt><dd>${e(`${entry.confidence} %`)}</dd>
          <dt>${e(game.i18n.localize(`${MODULE_ID}.forecast.field.trend`))}</dt><dd>${e(trend)}</dd>
          <dt>${e(game.i18n.localize(`${MODULE_ID}.forecast.field.driver`))}</dt><dd>${e(driver)}</dd>
        </dl>
        <p>${e(hint)}</p>
      </article>`;
    }).join("");
    return `<article class="pf2e-weather-forge-chat-card pf2e-weather-forge-forecast-card">
      <h2><i class="fas fa-chart-line"></i> ${e(title)}</h2>
      <p>${e(game.i18n.localize(`${MODULE_ID}.forecast.chatHint`))}</p>
      ${rows}
    </article>`;
  }

}
