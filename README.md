# PF2e Weather Forge 1.1.3

PF2e Weather Forge is a persistent, localized weather simulation for Foundry VTT and Pathfinder 2e.

It supports climate-driven generation, forecasts, history, extreme weather, an internal Golarion calendar fallback, optional Calendar Forge time integration, and now optional City Forge active-Scene climate integration.

## 1.1.0: City Forge Deep Integration

Weather Forge can now use the active Scene to ask City Forge where the party currently is.

If City Forge resolves the Scene to a settlement, district, or location, Weather Forge can automatically derive its generation climate from City Forge geography.

### Automatic climate context

The default source mode is:

`Automatic: City Forge, otherwise fallback`

Weather Forge uses City Forge only when:

- City Forge is active and exposes the 0.8.x integration API
- an active Scene exists
- that Scene resolves to a City Forge settlement
- City climate or terrain maps safely to a Weather Forge climate zone

Otherwise the configured manual climate is used.

You can switch to `Always manual` at any time.

### Visible context

The Generator tab shows:

- City Forge status
- settlement / district / location path
- effective Weather Forge climate
- City region
- City terrain
- City climate
- manual fallback when applicable

### No silent Scene rewrite

Switching Scenes does not replace accepted weather.

Weather Forge keeps the last accepted weather and warns when it was generated for another City Forge place.

Pending previews are discarded on a Scene/context change because they would otherwise be based on stale geography.

### Calendar Forge + City Forge

Both integrations can operate at the same time:

- Calendar Forge supplies time, season, moon and daypart
- City Forge supplies active place and climate
- Weather Forge generates the weather

Calendar-driven automatic and queued daypart weather now use the active City Forge climate too.

### Forecast

Forecast generation also uses the active City climate.

Forecast data records City context provenance just like generated weather.

### API

```js
const weather = game.modules.get("pf2e-weather-forge")?.api;

weather.getCityForgeStatus();
await weather.getClimateContext();
await weather.getCurrentWeatherContext();
```

The API remains version 1 and gains additive City Forge capabilities.

See `CITY-FORGE-INTEGRATION.md` for the integration contract and mapping behavior.

## Compatibility

- Foundry VTT: minimum 13, verified 14
- PF2e: supported
- City Forge: optional, designed for 0.8.1+
- Calendar Forge: optional
- No hard module dependencies

## Existing functionality retained

- climate zones
- current weather and preview workflow
- humidity / clouds / wind / precipitation
- daily temperature profiles and trends
- extreme weather
- forecasts
- weather history
- GM/public chat output
- internal Golarion calendar fallback
- Calendar Forge date/time/season/moon integration
- manual and automatic Calendar Forge daypart weather


## 1.1.1 explicit City Forge settlement source

Climate source now offers three modes:

1. **Automatic from active Scene**: resolves settlement/district/location through City Forge.
2. **City Forge settlement**: uses an explicitly selected settlement independent of the viewed Scene.
3. **Manual**: ignores City Forge.

City Forge 0.8.2 stores the same canonical climate ids as Weather Forge, so the normal integration path no longer relies on free-text interpretation.


## 1.1.2 source-selection UX fix

Choosing a City Forge settlement now automatically activates the explicit `City Forge settlement` source mode and refreshes the displayed context immediately.

This prevents a selected settlement from appearing to be active while the source mode still points at the active Scene.


## 1.1.3 City-source control hotfix

City climate-source controls now persist their own settings directly instead of trying to serialize the ApplicationV2 root element.

This fixes both symptoms caused by the previous live-control handler:

- the UI no longer jumps back to Weather Generation when source/settlement changes
- the selected explicit City Forge settlement is now actually used for effective climate resolution
