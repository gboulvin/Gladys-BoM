# Bureau of Meteorology (BoM)

Australian weather in Gladys, straight from the **Bureau of Meteorology**:
current conditions from the nearest observation station, hourly and 7-day
forecasts, warnings in force and the fire danger rating. No account and no API
key are needed. The BoM only covers **Australia**.

> This integration is not affiliated with or endorsed by the Bureau of
> Meteorology. It reads the public API used by the BoM website and app; for
> official warnings, always check [bom.gov.au](https://www.bom.gov.au/) and
> your state emergency services.

## What you get

- **Gladys weather**: the integration becomes the weather provider of Gladys.
  The dashboard weather widget and the assistant ("what's the weather
  tomorrow?") use BoM data, in °C or °F depending on your profile.
- **Weather alerts**: BoM warnings in force at your location (severe
  thunderstorm, flood, heatwave, cyclone, marine wind…) and, optionally, a
  fire danger rating of High, Extreme or Catastrophic, as Gladys weather
  alerts.
- **Three dashboard widgets**, **three scene triggers** and **three scene
  actions**, described below.

## Configuration

1. Install the integration. The install screen asks for access to the
   position of your houses: the integration uses it to know which place to
   monitor when no location is configured.
2. Open the **Configuration** tab:
   - **Location**: a suburb, a town, a postcode (`2150`) or
     `latitude,longitude`. Leave it empty to use the position of your Gladys
     house (Settings → Houses). Not sure about the spelling? Use the
     **Find a location** button.
   - **Warning check interval**: how often (5 to 60 minutes, 10 by default)
     the warnings and the fire danger rating are checked to fire your scenes.
   - **Fire danger as weather alerts**: report the High, Extreme and
     Catastrophic ratings as Gladys weather alerts.
3. Save, then click **Test the connection**: it shows the place found and the
   latest temperature observed nearby.

## Dashboard widgets

Add them from the dashboard editor. Each widget has an optional **Location**
setting to show another place than the configured one.

- **BoM conditions**: observed temperature, feels-like, humidity and wind,
  the temperature curve of the next 24 hours, today's summary, rain since
  9am, fire danger rating and maximum UV index.
- **BoM 7-day forecast**: one row per day with the minimum and maximum, the
  summary and the chance of rain; tap a day for the detailed forecast.
- **BoM warnings**: the warnings in force, major first, each with a link to
  the BoM warning page, a **Refresh** button (checks again right away) and a
  link to all the warnings of your state.

## Scenes

In the scene editor, the cards are in the **Integrations** category.

### Triggers

- **BoM warning issued**: a new warning covers the location. Optional
  filters: warning type (flood, severe thunderstorm, heatwave, tropical
  cyclone…) and severity (major, minor). Empty filters match any warning.
- **BoM warning ended**: a warning was cancelled or expired. Same filters.
- **Fire danger rating changed**: today's fire danger rating changed;
  optionally filter on the new rating (e.g. only Extreme and Catastrophic).

The following actions can read the details: `{{triggerEvent.data.title}}`,
`{{triggerEvent.data.area}}`, `{{triggerEvent.data.severity}}`,
`{{triggerEvent.data.expiry_time}}`, `{{triggerEvent.data.rating}}`…

The first check after installation records the current situation without
firing anything: the triggers announce what changes.

### Actions

Each action has an optional **Location** field (scene variables accepted);
empty, it uses the configured location. Values are metric (°C, km/h, mm).

- **Get BoM current conditions**: temperature, feels-like, humidity, wind,
  gusts, rain since 9am, minimum and maximum so far, station.
- **Get BoM forecast**: for today or one of the next 6 days: minimum,
  maximum, summary, detailed text, chance and amount of rain, UV, fire
  danger, sunrise and sunset.
- **Get BoM warnings**: number of warnings in force (total, major, minor),
  whether a major one is in force, and their names.

Example: _every morning at 7, get tomorrow's forecast; if the chance of rain is
above 60, send "Rain expected: {{…summary}}" and skip the garden watering._

## Good to know

- Forecast texts and warning titles come from the BoM in English.
- Data is cached a few minutes (warnings 2 minutes, observations 5, forecasts 15) to stay light on the BoM servers.
- Outside Australia, the integration refuses the request and Gladys falls back
  to its other weather provider.

## Troubleshooting

- **"No location"**: fill the Location field, or set the position of your
  house in Gladys.
- **"No Australian location matches"**: try the postcode, or use **Find a
  location**.
- **"Outside the area covered"**: the position of your house is not in
  Australia; set a Location.
- Logs: Integrations → Bureau of Meteorology (BoM) → Supervision.
