# Weather Forge 1.1.0 ↔ City Forge 0.8.1 Integration

## Goal

Weather Forge now consumes the City Forge weather context for the **currently active Foundry Scene**.

The integration is optional. Weather Forge remains fully usable without City Forge.

## Runtime flow

```text
Active Foundry Scene
        ↓
City Forge scene resolution
        ↓
Settlement → District → Location
        ↓
Region / Terrain / Climate
        ↓
Weather Forge climate mapping
        ↓
Weather generation / forecast / Calendar Forge daypart generation
```

City Forge resolves location specificity in this order:

1. linked location
2. linked district
3. settlement-level Scene link

Weather Forge never writes City Forge data.

## Climate source modes

Weather Forge 1.1.0 adds two modes:

### Automatic: City Forge, otherwise fallback

If the active Scene resolves to City Forge and its climate or terrain can be mapped safely, Weather Forge uses that climate zone.

If not, it uses the configured manual/fallback climate.

### Always manual

City Forge is ignored for weather generation and Weather Forge behaves like the previous manual climate workflow.

## Mapping

City Forge climate is intentionally free-form text.

Weather Forge therefore maps only known/high-confidence climate words to its existing climate zones:

- temperate
- mediterranean
- coastal
- arctic
- desert
- tropical
- mountain
- swamp
- magical

German and English names are supported, including common variants such as:

- `Gemäßigt` → `temperate`
- `Mediterran` → `mediterranean`
- `Küste` / `Maritim` → `coastal`
- `Arktisch` / `Tundra` → `arctic`
- `Wüste` → `desert`
- `Tropisch` / `Regenwald` → `tropical`
- `Gebirge` / `Alpin` → `mountain`
- `Sumpf` / `Moor` → `swamp`
- `Magisch` → `magical`

The City Forge `climate` field is tried first.

If climate text cannot be mapped, Weather Forge may use the City Forge `terrain` field for obvious terrain-driven cases such as coast, desert, mountain, swamp, tundra, or rainforest.

If neither can be mapped, Weather Forge does **not** guess. It falls back to the manually configured Weather Forge climate.

## Generation paths covered

The effective active-Scene climate is used by:

- normal next-daypart generation
- reset / initial weather generation
- Weather Forge forecast generation
- Calendar Forge current-daypart preview
- Calendar Forge queued next-daypart preview
- Calendar Forge automatic daypart generation
- Weather Forge public `generateForecast()` API

## Current weather provenance

Accepted/generated weather stores context metadata:

```js
{
  weatherForgeClimateSource: "cityForge",
  weatherForgeClimateReason: "city-climate",
  weatherForgeCityContext: {
    sceneUuid,
    settlementId,
    settlementName,
    settlementRevision,
    districtId,
    districtName,
    locationId,
    locationName,
    region,
    terrain,
    climate,
    resolvedClimateZone,
    mappingField,
    mappingValue
  }
}
```

This does not copy City Forge settlement data for ownership purposes. It is generation provenance, similar to recording which context produced a weather result.

## Scene changes

Changing Scene does **not** silently rewrite accepted weather.

Instead:

- pending weather previews are invalidated
- queued Calendar Forge previews are invalidated
- the Weather Forge window rerenders
- future generation uses the new active Scene context
- if current accepted weather belongs to another City Forge place, Weather Forge displays a warning

This is important because Weather Forge 1.1.0 still has one world-level current weather state. Merely looking at a different Scene should not fabricate a new accepted weather state.

## City settlement changes

City Forge settlement create/update/delete events invalidate pending Weather Forge previews in automatic climate mode.

If an accepted weather state was generated under an older settlement revision or a climate mapping changes, Weather Forge displays the context-mismatch warning until new weather is generated/accepted.

## Calendar Forge interaction

Calendar Forge owns date, season, moon, and daypart timing.

City Forge owns settlement/place climate context.

Weather Forge combines both:

```text
Calendar Forge → when / season
City Forge     → where / climate
Weather Forge  → meteorological result
```

Neither provider replaces the other.

## Public Weather Forge API

Weather Forge 1.1.0 keeps API version 1 and adds capabilities:

```js
const weather = game.modules.get("pf2e-weather-forge")?.api;

weather.version === 1;
weather.capabilities.cityForgeClimate === true;
weather.capabilities.activeSceneClimate === true;
weather.capabilities.currentWeatherContext === true;
```

### Provider status

```js
weather.getCityForgeStatus();
```

### Effective climate context

```js
await weather.getClimateContext();
```

Or for a specific Scene:

```js
await weather.getClimateContext({
  sceneUuid: "Scene.…"
});
```

### Current weather plus provenance

```js
await weather.getCurrentWeatherContext();
```

This provides a clean read-back surface for a later City Forge UI badge or other Forge consumers without requiring them to inspect Weather Forge world settings.

## Ownership

### City Forge owns

- settlement definition
- region / terrain / climate hints
- district and location links
- Scene resolution

### Weather Forge owns

- climate mapping into Weather Forge zones
- current accepted weather
- previews
- forecast
- weather history
- extreme weather
- weather generation
- current-weather provenance

### Calendar Forge owns

- calendar
- world-time interpretation
- season
- moon phase
- daypart timing

## Not implemented automatically

Weather Forge does **not** turn weather into City Forge Dynamic State changes.

Examples such as:

- blizzard → supply −1
- heatwave → health −1
- storm → security/order effects

must remain explicit rules later. The same weather can have radically different consequences for different settlements.


## 1.1.1 source selection

Weather Forge now supports three explicit climate sources.

### Automatic from active Scene

Uses `api.integrations.getContextForScene(sceneUuid, "weather")` and therefore preserves the location → district → settlement specificity of City Forge.

### City Forge settlement

Uses the selected stable settlement id and calls:

```js
await city.integrations.weather.getContext(settlementId);
```

This mode is intentionally independent of the active Scene. Weather Forge stores only the selected settlement id, never a copied settlement record.

### Manual

Ignores City Forge entirely.

## Canonical climate ids

City Forge 0.8.2 stores the same nine ids as Weather Forge. Those ids are consumed directly.

The alias mapper remains in Weather Forge only for compatibility with City Forge 0.8.1 and older/imported free-text climate data.
