# PF2e Weather Forge

PF2e Weather Forge is a localized Foundry VTT module for Pathfinder Second Edition that generates persistent, climate-aware weather using an internal Golarion calendar.

## Features

- GM-only scene toolbar button
- Foundry V13/V14 compatible ApplicationV2 UI
- Three-column layout: current weather, settings/calendar, preview
- Internal Calendar Forge with Golarion weekdays, months, seasons, moon phases, and time segments
- Climate zones including temperate, coastal, arctic, desert, tropical, mountain, swamp, magical, and mediterranean
- Living Weather v0.3:
  - Daily minimum and maximum temperatures
  - Temperature curve by time segment
  - Warmer/cooler/stable daily trend
  - Time-weighted weather phenomena
  - More likely mist at night/morning
  - More likely thunderstorms in afternoon/evening
  - Multi-segment and multi-day extreme weather patterns
- Localized German and English UI

## API

```js
game.modules.get("pf2e-weather-forge").api.open();
game.modules.get("pf2e-weather-forge").api.getWeather();
await game.modules.get("pf2e-weather-forge").api.getCalendar();
```

## Publishing Notes

Before publishing, update `module.json` with your GitHub repository URL, manifest URL, download URL, author name, and Discord name.

## License

MIT
