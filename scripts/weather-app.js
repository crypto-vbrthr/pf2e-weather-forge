import { MODULE_ID, CLIMATE_ZONES, TIME_SEGMENTS, WEEKDAYS, MONTHS, MONTH_LENGTHS, defaultWeatherState, createInitialWeatherState, generateNextWeather } from "./weather-engine.js";
import { MOON_PHASES, applyCalendarToWeather, calendarFromFormData, extractCalendarFromWeather, getCalendarState, setCalendarState, advanceTimeSegment, rewindTimeSegment, advanceCalendarDate, normalizeCalendarState } from "./calendar-engine.js";
import { appendWeatherHistory, clearWeatherHistory, getWeatherHistory, historyDescriptorKey } from "./history-engine.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PF2eWeatherForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "pf2e-weather-forge-app",
    tag: "form",
    window: {
      title: `${MODULE_ID}.app.title`,
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
      clearHistory: PF2eWeatherForgeApp.#onClearHistory
    }
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/weather-forge.hbs`
    }
  };

  async _prepareContext(options) {
    const calendar = await getCalendarState();
    const storedCurrent = game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState();
    const storedPreview = game.settings.get(MODULE_ID, "weatherPreview") ?? null;
    const current = applyCalendarToWeather(storedCurrent, calendar);
    const preview = storedPreview ? storedPreview : null;

    return {
      current: this.#prepareWeather(current),
      preview: preview ? this.#prepareWeather(preview) : null,
      calendar: this.#prepareCalendar(calendar),
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
      history: this.#prepareHistory(getWeatherHistory())
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
          entries: []
        });
      }
      groups.get(dateKey).entries.push(this.#prepareHistoryEntry(entry));
    }

    const prepared = [...groups.values()].reverse().map(group => {
      const latest = group.entries[group.entries.length - 1];
      return {
        ...group,
        weekdayLabel: game.i18n.localize(`${MODULE_ID}.weekday.${group.weekday}`),
        monthLabel: game.i18n.localize(`${MODULE_ID}.month.${group.month}`),
        seasonLabel: game.i18n.localize(`${MODULE_ID}.season.${group.season}`),
        moonPhaseLabel: game.i18n.localize(`${MODULE_ID}.moon.${group.moonPhase}`),
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
    return {
      ...calendar,
      timeSegmentLabel: game.i18n.localize(`${MODULE_ID}.time.${calendar.timeSegment}`),
      weekdayLabel: game.i18n.localize(`${MODULE_ID}.weekday.${calendar.weekday}`),
      monthLabel: game.i18n.localize(`${MODULE_ID}.month.${calendar.month}`),
      moonPhaseLabel: game.i18n.localize(`${MODULE_ID}.moon.${calendar.moonPhase}`),
      seasonLabel: game.i18n.localize(`${MODULE_ID}.season.${calendar.season}`)
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
      weekdayLabel: game.i18n.localize(`${MODULE_ID}.weekday.${weather.weekday}`),
      monthLabel: game.i18n.localize(`${MODULE_ID}.month.${weather.month}`),
      moonPhaseLabel: game.i18n.localize(`${MODULE_ID}.moon.${weather.moonPhase}`),
      seasonLabel: game.i18n.localize(`${MODULE_ID}.season.${weather.season}`),
      description: game.i18n.localize(`${MODULE_ID}.${weather.descriptionKey}`),
      dailyMinTemp: weather.dailyProfile?.minTemp ?? weather.temperature,
      dailyMaxTemp: weather.dailyProfile?.maxTemp ?? weather.temperature,
      trendLabel: game.i18n.localize(`${MODULE_ID}.trend.${weather.dailyProfile?.trend ?? "stable"}`),
      extremeLabel: weather.extremeWeather
        ? `${game.i18n.localize(`${MODULE_ID}.extreme.${weather.extremeWeather.type}`)} · ${game.i18n.localize(`${MODULE_ID}.extremePhase.${weather.extremeWeather.phase ?? "active"}`)} · ${weather.extremeWeather.remainingSegments ?? "?"}`
        : game.i18n.localize(`${MODULE_ID}.extreme.none`)
    };
  }

  static async #syncCalendarToWeather(calendar) {
    const current = game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState();
    await game.settings.set(MODULE_ID, "weatherState", applyCalendarToWeather(current, calendar));
    await game.settings.set(MODULE_ID, "weatherPreview", null);
  }

  static async #onGenerate(event, target) {
    event.preventDefault();
    const form = target.closest("form") ?? this.element;
    const fd = new FormData(form);
    const calendar = await setCalendarState(calendarFromFormData(fd));
    const current = applyCalendarToWeather(game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState(), calendar);
    const preview = generateNextWeather(current, {
      climateZone: fd.get("climateZone"),
      allowExtreme: fd.get("allowExtreme") === "on",
      forceExtreme: fd.get("forceExtreme") === "on",
      extremeType: fd.get("extremeType")
    });
    await game.settings.set(MODULE_ID, "weatherPreview", preview);
    this.render();
  }

  static async #onAccept(event) {
    event.preventDefault();
    const preview = game.settings.get(MODULE_ID, "weatherPreview");
    if (!preview) return;
    await game.settings.set(MODULE_ID, "weatherState", preview);
    await appendWeatherHistory(preview);
    await setCalendarState(extractCalendarFromWeather(preview));
    await game.settings.set(MODULE_ID, "weatherPreview", null);
    ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notification.weatherAccepted`));
    this.render();
  }

  static async #onReset(event, target) {
    event.preventDefault();
    const form = target.closest("form") ?? this.element;
    const fd = new FormData(form);
    const climateZone = fd.get("climateZone") || "temperate";
    const calendar = await setCalendarState(calendarFromFormData(fd));
    await game.settings.set(MODULE_ID, "weatherState", applyCalendarToWeather(createInitialWeatherState(climateZone, calendar), calendar));
    await game.settings.set(MODULE_ID, "weatherPreview", null);
    ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notification.weatherReset`));
    this.render();
  }

  static async #onSaveCalendar(event, target) {
    event.preventDefault();
    const form = target.closest("form") ?? this.element;
    const fd = new FormData(form);
    const calendar = calendarFromFormData(fd);
    await setCalendarState(calendar);
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
    const baseCalendar = PF2eWeatherForgeApp.#calendarFromCurrentForm(target, this);
    const calendar = advanceTimeSegment(baseCalendar);
    await setCalendarState(calendar);
    await PF2eWeatherForgeApp.#syncCalendarToWeather(calendar);
    this.render();
  }

  static async #onPreviousTime(event, target) {
    event.preventDefault();
    const baseCalendar = PF2eWeatherForgeApp.#calendarFromCurrentForm(target, this);
    const calendar = rewindTimeSegment(baseCalendar);
    await setCalendarState(calendar);
    await PF2eWeatherForgeApp.#syncCalendarToWeather(calendar);
    this.render();
  }

  static async #onNextDay(event, target) {
    event.preventDefault();
    const baseCalendar = PF2eWeatherForgeApp.#calendarFromCurrentForm(target, this);
    const calendar = advanceCalendarDate(baseCalendar, 1);
    await setCalendarState(calendar);
    await PF2eWeatherForgeApp.#syncCalendarToWeather(calendar);
    this.render();
  }

  static async #onPreviousDay(event, target) {
    event.preventDefault();
    const baseCalendar = PF2eWeatherForgeApp.#calendarFromCurrentForm(target, this);
    const calendar = advanceCalendarDate(baseCalendar, -1);
    await setCalendarState(calendar);
    await PF2eWeatherForgeApp.#syncCalendarToWeather(calendar);
    this.render();
  }

  static async #onClearHistory(event) {
    event.preventDefault();
    await clearWeatherHistory();
    ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notification.historyCleared`));
    this.render();
  }
}
