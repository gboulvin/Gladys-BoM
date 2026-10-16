// -----------------------------------------------------------------------------
// Dashboard widgets (manifest `widgets`, Gladys 5.1+).
//
//   - bom_current   current conditions: observed temperature, feels like,
//                   humidity and wind, the next 24 hours of temperature, and
//                   today's summary, fire danger rating and UV index;
//   - bom_forecast  the 7-day forecast, one row per day;
//   - bom_warnings  the warnings in force, with a link to the BoM product
//                   page of each, and a Refresh button.
//
// Each widget instance can show another place than the configured one
// (`location` setting). The content is declarative (the core renders it with
// its own theme), produced in the language and unit system of the viewer.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import {
  getDailyForecasts,
  getHourlyForecasts,
  getObservations,
  getWarnings,
} from './bom/client.js';
import { locationLabel, resolveLocation } from './bom/location.js';
import {
  fireDangerColor,
  fireDangerKey,
  isActiveWarning,
  warningSeverityKey,
  warningUrl,
} from './bom/mapping.js';
import { FIRE_DANGER_LABELS, T, fill, pick } from './i18n.js';
import { displaySpeed, isNum, precipitation, temperature, unitLabels } from './units.js';
import { upcomingHours } from './weather.js';

const logger = createLogger({ name: 'widgets' });

export const WIDGET_KEYS = {
  CURRENT: 'bom_current',
  FORECAST: 'bom_forecast',
  WARNINGS: 'bom_warnings',
};

export const WIDGET_ACTIONS = { REFRESH: 'refresh' };

const truncate = (text, max) => {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

const dash = (value) => (value === undefined || value === null ? '—' : value);

function formatter(language, timezone, options) {
  try {
    return new Intl.DateTimeFormat(language, {
      timeZone: timezone ?? 'Australia/Sydney',
      ...options,
    });
  } catch {
    return new Intl.DateTimeFormat('en', { timeZone: 'Australia/Sydney', ...options });
  }
}

export function formatTime(iso, language, timezone) {
  if (!iso) return '—';
  return formatter(language, timezone, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

export function formatDay(iso, language, timezone) {
  return formatter(language, timezone, { weekday: 'long', day: 'numeric', month: 'short' }).format(
    new Date(iso),
  );
}

function formatDateTime(iso, language, timezone) {
  if (!iso) return '—';
  return formatter(language, timezone, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** The content shown when the place cannot be read: the reason, in a sentence. */
function errorContent(err, language) {
  const message = err.userMessage
    ? pick(err.userMessage, language)
    : pick(T.bomUnavailable, language);
  return {
    ttl_seconds: 120,
    components: [{ type: 'text', variant: 'body', text: truncate(message, 300) }],
  };
}

async function currentContent(location, { language, units }) {
  const [obs, hourly, daily] = await Promise.all([
    getObservations(location.geohash),
    getHourlyForecasts(location.geohash),
    getDailyForecasts(location.geohash),
  ]);
  const unit = unitLabels(units);
  const hours = upcomingHours(hourly);
  const now = hours[0];
  const today = daily[0];

  const temp = isNum(obs?.temp) ? obs.temp : now?.temp;
  const feels = isNum(obs?.temp_feels_like) ? obs.temp_feels_like : now?.temp_feels_like;
  const humidity = isNum(obs?.humidity) ? obs.humidity : now?.relative_humidity;
  const wind = obs?.wind ?? now?.wind;
  const fire = fireDangerKey(today?.fire_danger);

  const components = [
    { type: 'text', variant: 'heading', text: truncate(locationLabel(location), 40) },
  ];
  if (obs?.station?.name) {
    components.push({
      type: 'text',
      variant: 'caption',
      text: truncate(
        pick(
          fill(T.observedAt, {
            station: obs.station.name,
            time: formatTime(obs.observation_time, language, location.timezone),
          }),
          language,
        ),
        80,
      ),
    });
  }
  components.push(
    {
      type: 'value',
      label: T.temperature,
      icon: 'thermometer',
      value: dash(temperature(temp, units)),
      unit: unit.temperature,
    },
    {
      type: 'value',
      label: T.feelsLike,
      icon: 'user',
      value: dash(temperature(feels, units)),
      unit: unit.temperature,
    },
    {
      type: 'value',
      label: T.humidity,
      icon: 'droplet',
      value: dash(isNum(humidity) ? humidity : undefined),
      unit: '%',
    },
    {
      type: 'value',
      label: fill(
        { en: 'Wind {dir}', fr: 'Vent {dir}', de: 'Wind {dir}', es: 'Viento {dir}' },
        { dir: wind?.direction && wind.direction !== 'CALM' ? wind.direction : '' },
      ),
      icon: 'wind',
      value: dash(displaySpeed(wind?.speed_kilometre, units)),
      unit: unit.speed,
    },
  );

  const points = hours
    .slice(0, 24)
    .filter((hour) => isNum(hour.temp))
    .map((hour) => ({ t: hour.time, v: temperature(hour.temp, units) }));
  if (points.length > 1) {
    components.push({
      type: 'chart',
      chart_type: 'area',
      title: T.nextHours,
      unit: unit.temperature,
      series: [{ name: T.temperature, points }],
    });
  }

  const status = [];
  if (today?.short_text) {
    status.push({
      label: T.today,
      icon: 'sun',
      value: truncate(today.short_text, 40),
      color: WIDGET_COLORS.INFO,
    });
  }
  if (isNum(obs?.rain_since_9am)) {
    status.push({
      label: T.rainSince9am,
      icon: 'cloud-rain',
      value: `${precipitation(obs.rain_since_9am, units)} ${unit.precipitation}`,
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  status.push({
    label: T.fireDanger,
    icon: 'alert-triangle',
    value: FIRE_DANGER_LABELS[fire],
    color: fireDangerColor(fire),
  });
  if (isNum(today?.uv?.max_index)) {
    status.push({
      label: T.uvIndex,
      icon: 'sun',
      value: `${today.uv.max_index}`,
      color:
        today.uv.max_index >= 8
          ? WIDGET_COLORS.DANGER
          : today.uv.max_index >= 3
            ? WIDGET_COLORS.WARNING
            : WIDGET_COLORS.SUCCESS,
    });
  }
  components.push({ type: 'status', items: status });

  return { ttl_seconds: 600, components };
}

async function forecastContent(location, { language, units }) {
  const daily = await getDailyForecasts(location.geohash);
  const unit = unitLabels(units);
  const items = daily.slice(0, 7).map((day, index) => {
    const min = temperature(day.temp_min, units);
    const max = temperature(day.temp_max, units);
    const range = [min, max].filter((v) => v !== undefined).join('° – ');
    const title =
      index === 0
        ? pick(T.today, language)
        : index === 1
          ? pick(T.tomorrow, language)
          : formatDay(day.date, language, location.timezone);
    const fire = fireDangerKey(day.fire_danger);
    const details = [day.extended_text];
    if (fire !== 'no_rating') {
      details.push(`${pick(T.fireDanger, language)}: ${pick(FIRE_DANGER_LABELS[fire], language)}`);
    }
    if (isNum(day.uv?.max_index)) {
      details.push(`${pick(T.uvIndex, language)}: ${day.uv.max_index}`);
    }
    const item = {
      title: truncate(title, 60),
      subtitle: truncate(
        [range ? `${range}${unit.temperature}` : null, day.short_text].filter(Boolean).join(' · '),
        80,
      ),
      date: day.date,
      description: truncate(details.filter(Boolean).join('\n'), 2000),
    };
    if (isNum(day.rain?.chance)) {
      item.badge = {
        text: `☂ ${day.rain.chance}%`,
        color: day.rain.chance >= 60 ? WIDGET_COLORS.INFO : WIDGET_COLORS.NEUTRAL,
      };
    }
    return item;
  });

  const components = [
    {
      type: 'text',
      variant: 'heading',
      text: truncate(pick(fill(T.forecastIssued, { location: location.name }), language), 40),
    },
  ];
  if (items.length > 0) {
    components.push({ type: 'card-list', display: 'list', items });
  }
  return { ttl_seconds: 1800, components };
}

async function warningsContent(location, { language }) {
  const active = (await getWarnings(location.geohash)).filter((w) => isActiveWarning(w));
  active.sort(
    (a, b) =>
      (warningSeverityKey(a) === 'major' ? 0 : 1) - (warningSeverityKey(b) === 'major' ? 0 : 1),
  );
  const components = [
    {
      type: 'text',
      variant: 'heading',
      text: truncate(pick(fill(T.warningsFor, { location: location.name }), language), 40),
    },
  ];
  if (active.length === 0) {
    components.push({
      type: 'status',
      items: [
        {
          label: T.noWarnings,
          icon: 'check-circle',
          value: locationLabel(location).slice(0, 40),
          color: WIDGET_COLORS.SUCCESS,
        },
      ],
    });
  } else {
    components.push({
      type: 'card-list',
      display: 'list',
      items: active.slice(0, 8).map((warning) => {
        const major = warningSeverityKey(warning) === 'major';
        return {
          title: truncate(warning.short_title ?? warning.type, 60),
          subtitle: truncate(warning.title, 80),
          date: warning.issue_time ?? undefined,
          badge: {
            text: pick(major ? T.major : T.minor, language).slice(0, 16),
            color: major ? WIDGET_COLORS.DANGER : WIDGET_COLORS.WARNING,
          },
          description: truncate(
            [
              warning.title,
              pick(
                fill(T.expires, {
                  time: formatDateTime(warning.expiry_time, language, location.timezone),
                }),
                language,
              ),
            ].join('\n'),
            2000,
          ),
          links: [{ url: warningUrl(warning), label: 'bom.gov.au' }],
        };
      }),
    });
  }
  components.push(
    {
      type: 'button',
      label: T.refresh,
      icon: 'refresh-cw',
      style: 'secondary',
      action: { key: WIDGET_ACTIONS.REFRESH },
    },
    {
      type: 'button',
      label: T.allWarnings,
      icon: 'external-link',
      style: 'secondary',
      link: {
        url: location.state
          ? `https://www.bom.gov.au/${location.state.toLowerCase()}/warnings/`
          : 'https://www.bom.gov.au/australia/warnings/',
      },
    },
  );
  return { ttl_seconds: 300, components };
}

function widget(key, build) {
  return {
    async get(gladys, { settings = {}, language = 'en', units = 'metric', config }) {
      logger.debug(`onWidgetGet <- ${key}`);
      try {
        const location = await resolveLocation(gladys, config, { query: settings.location });
        return await build(location, { language, units: units === 'us' ? 'us' : 'metric' });
      } catch (err) {
        logger.warn(`Widget ${key}: ${err.message}`);
        return errorContent(err, language);
      }
    },
    // `refresh` (the only button action) drops the cached BoM data and runs a
    // warning check right away; the core then re-pulls the content.
    async action(gladys, { actionKey, refresh }) {
      logger.info(`onWidgetAction <- ${key}.${actionKey}`);
      if (actionKey !== WIDGET_ACTIONS.REFRESH) {
        throw new Error(`Unknown widget action: ${actionKey}`);
      }
      await refresh?.();
      return T.refreshed;
    },
  };
}

export const WIDGETS = {
  [WIDGET_KEYS.CURRENT]: widget(WIDGET_KEYS.CURRENT, currentContent),
  [WIDGET_KEYS.FORECAST]: widget(WIDGET_KEYS.FORECAST, forecastContent),
  [WIDGET_KEYS.WARNINGS]: widget(WIDGET_KEYS.WARNINGS, warningsContent),
};

/** Ask the core to re-pull every widget now (rate-limited core-side). */
export function refreshWidgets(gladys, keys = Object.keys(WIDGETS)) {
  for (const key of keys) {
    gladys.requestWidgetRefresh(key);
  }
}
