# PF2E Weather Forge

A weather and forecast simulation for Pathfinder Second Edition Remastered on Foundry Virtual Tabletop, with optional Calendar Forge integration and a built-in calendar fallback.

PF2E Weather Forge provides persistent, evolving weather generation, weather history, forecasting, climate zones, extreme weather events and chat integration. When Calendar Forge is active it can read date, local time, season and moon phase directly from that module; without Calendar Forge, the existing internal Golarion calendar continues to work as before.



## Main Window

![Main Window](screenshots/main_window.png)
![Forecast](screenshots/forecast.png)
![History](screenshots/history.png)



## Features

### Weather Generation

* Persistent weather system
* Realistic temperature progression throughout the day
* Climate-based weather generation
* Seasonal temperature ranges
* Humidity, cloud cover and wind strength
* Localized weather descriptions
* Extreme weather events
* Multi-stage weather systems

### Calendar & Daypart Integration

Weather Forge can use **Calendar Forge** as its authoritative calendar source. In that mode it reads:

* Date and local clock time
* Season
* Moon phase
* Calendar / regional context

Weather Forge never advances Calendar Forge time. Instead it reacts when Foundry world time crosses configured daypart boundaries. The defaults are:

* Morning 05:00
* Noon 11:00
* Afternoon 14:00
* Evening 18:00
* Night 22:00

Skipped dayparts are resolved automatically and chronologically so weather continues to evolve rather than jumping directly from the old state to the new one. Only the currently reached daypart remains open for manual generation. Once it is resolved, a preview for the next daypart can be prepared in advance. Runtime checkpoints make catch-up restart-safe, and prepared previews are invalidated when their source weather or target calendar context changes.

If Calendar Forge is disabled or unavailable, Weather Forge uses its existing internal Golarion calendar and time controls unchanged. A compatible last Golarion date from Calendar Forge can seed the fallback so the calendar does not jump back to an older internal state.

### Forecast System

Generate weather forecasts based on actual weather trends.

* 1 / 3 / 5 / 7 day forecasts
* Temperature ranges
* Rain probability
* Storm probability
* Confidence indicator
* Forecasts influence future weather generation

### Weather History

Track historical weather data.

* Weather history by date
* Time-of-day entries
* Configurable history limits
* Historical weather review

### Climate Zones

Supported climate zones:

* Arctic
* Temperate
* Mediterranean
* Tropical
* Desert
* Mountain
* Coastal
* Swamp

### Chat Integration

Publish weather reports directly to chat.

* GM-only weather reports
* Public weather reports
* Forecast reports
* Localized chat cards

### Localization

Included translations:

* English
* German

## User Interface

The Weather Forge interface is divided into four tabs:

### Weather

Current weather conditions and generation controls.

### Forecast

Weather forecasts and weather trend information.

### History

Historical weather records.

### Settings

Climate zones, history settings, calendar controls and weather options.

## Installation

### Manifest URL

Add the manifest URL in Foundry's Install Module dialog.

```text
<manifest-url>
```

### Manual Installation

1. Download the latest release.
2. Extract the ZIP into:

```text
FoundryVTT/Data/modules/
```

3. Enable PF2E Weather Forge in your world.

## Compatibility

* Foundry VTT V14
* Pathfinder 2E Remastered

## License

MIT License

## Credits

Created for Pathfinder 2E Remastered and Foundry VTT.
