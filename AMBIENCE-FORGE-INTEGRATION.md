# Ambience Forge Integration

PF2e Weather Forge can optionally act as a semantic weather-state provider for Ambience Forge.

The integration follows the Forge Suite responsibility boundary:

> Weather Forge describes **what the weather is**.  
> Ambience Forge decides **what that weather sounds like**.

Ambience Forge is optional. Weather Forge must continue to function normally when Ambience Forge is not installed, inactive, or does not expose the required API capability.

## Required Ambience Forge capability

Weather Forge checks the public Ambience Forge API and requires:

```text
context-states-v1
```

State discovery is used when available:

```text
state-discovery-v1
```

Discovery is a convenience for the settings UI, not a requirement for runtime mapping.

## Persistent weather context

When enabled, Weather Forge publishes the accepted current weather through:

```js
await game.modules.get("ambience-forge")?.api?.setContextState({
  group: "weather",
  state: "rain",
  owner: "pf2e-weather-forge"
});
```

Ambience Forge applies this state to compatible compositions immediately and remembers it for compatible compositions started later in the same Foundry session.

This is intentionally different from changing only currently active ambiences.

## Default mapping

Weather Forge resolves its detailed weather model to a compact semantic audio state.

| Weather Forge condition | Default Ambience Forge state key |
| --- | --- |
| Clear | `clear` |
| Cloudy | `cloudy` |
| Fog / mist | `fog` |
| Drizzle / light rain / rain | `rain` |
| Heavy rain | `heavy-rain` |
| Thunderstorm / storm | `storm` |
| Snow | `snow` |
| Blizzard | `heavy-snow` |

Extreme storm, blizzard, and fog conditions take precedence over ordinary precipitation when resolving the semantic state.

Heat waves and cold snaps currently do not get their own Ambience Forge weather state. Their ordinary precipitation/cloud condition still applies. A separate temperature/climate semantic group can be added later without changing this contract.

## Independent wind context

Weather Forge can additionally publish wind strength as a separate semantic group. This is optional and independent from the `weather` group.

Default group key:

```text
wind
```

Default mapping:

| Weather Forge wind strength | Default Ambience Forge state key |
| --- | --- |
| 0 | `calm` |
| 1–2 | `breeze` |
| 3–5 | `windy` |
| 6–8 | `strong-wind` |
| 9–12 | `gale` |

A rainy, windy scene can therefore receive two simultaneous context values:

```text
weather = rain
wind = strong-wind
```

This avoids forcing every windy condition into the broader `storm` weather state. The wind group key and all state mappings are user-configurable through the same discovery-backed settings UI.

## User-defined API keys

The default Forge Suite state-group key is:

```text
weather
```

The Settings tab allows users to replace that key and every weather-state mapping.

When Ambience Forge state discovery is available, detected keys are offered as suggestions. The fields remain editable so custom naming schemes are supported.

Example custom mapping:

```text
Weather Forge: storm
Ambience group: weather-condition
Ambience state: violent-storm
```

Weather Forge then publishes:

```js
{
  group: "weather-condition",
  state: "violent-storm",
  owner: "pf2e-weather-forge"
}
```

## Update flow

Weather Forge synchronizes Ambience Forge when the accepted `weatherState` changes, regardless of whether that change came from:

- accepting a manually generated preview;
- Calendar Forge daypart automation;
- resetting weather;
- another legitimate Weather Forge workflow that writes the accepted weather state.

Preview-only weather does not become the current Ambience Forge context until it is actually accepted as Weather Forge's current weather.

Weather Forge also republishes the current accepted weather when `ambienceForgeReady` fires and during Foundry `ready`. This makes module load order irrelevant.

## Ownership and cleanup

All context requests use:

```text
owner = pf2e-weather-forge
```

When the integration is disabled or its group key changes, Weather Forge clears only context it owns. It does not remove another module's context.

## Public Weather Forge diagnostics

Weather Forge public API remains version 1 and exposes the additive capability:

```js
api.capabilities.ambienceForgeContext === true
```

Diagnostic helpers:

```js
api.getAmbienceForgeStatus();
api.getAmbienceIntegration();
await api.syncAmbience();
```

`getAmbienceIntegration()` returns the configured weather mapping and resolved weather kind plus the optional independent wind group, mapping, enable state, and resolved wind kind.

## No track-level coupling

Weather Forge must not rely on Ambience Forge track IDs, audio paths, volumes, or internal classes.

A composition is free to implement `weather = storm` however its author wants. For example:

```text
Forest + storm

Rain             louder
Light wind       disabled
Storm wind       enabled
Owls             quieter
Thunder          enabled
Branch breaks    enabled
```

The same `weather = storm` state may produce a completely different soundscape in a city, ship, cave entrance, or tavern.


## Automatically starting a composition

Weather Forge may optionally request one specific Ambience Forge composition while the integration is enabled. The composition is selected from Ambience Forge discovery data and is requested with `owner: "pf2e-weather-forge"`. Weather Forge releases only its own request when the option is disabled or another composition is selected. The semantic weather context is synchronized before the composition is requested so newly-started ambience begins in the current weather state.
