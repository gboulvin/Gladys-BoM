// -----------------------------------------------------------------------------
// Entry point of the Bureau of Meteorology (BoM) integration for Gladys.
//
// SDK wiring only — the work lives in src/:
//   - src/weather.js   weather provider (onWeatherGet, manifest type "weather")
//   - src/monitor.js   warning monitor, fires the scene triggers
//   - src/scenes.js    scene actions
//   - src/widgets.js   dashboard widgets
//   - src/actions.js   Configuration screen buttons
//
// Environment variables provided by the Gladys supervisor to the container
// (read by the SDK): GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN,
// GLADYS_INTEGRATION_SELECTOR.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import { getWeather } from './src/weather.js';
import { startMonitor } from './src/monitor.js';
import { SCENE_ACTIONS } from './src/scenes.js';
import { WIDGETS, WIDGET_KEYS, refreshWidgets } from './src/widgets.js';
import { ACTIONS } from './src/actions.js';
import { clearCache } from './src/bom/client.js';
import { UserFacingError, locationLabel, resolveLocation } from './src/bom/location.js';
import { T } from './src/i18n.js';

const gladys = new GladysIntegration();

// Current configuration (hot-reloaded via onConfigUpdated).
let config = normalizeConfig();
let stopMonitor = null;

// --- Weather provider ----------------------------------------------------------
// Gladys asks for the weather of a house (dashboard widget, chat, the 30-minute
// alert check). Throwing (outside Australia, BoM down) lets Gladys fall back to
// the next weather provider.
gladys.onWeatherGet((options) => getWeather(gladys, config, options));

// --- Configuration screen buttons ------------------------------------------------
// A problem the user can fix (unknown place, no location) is answered as a
// message in their language rather than as a raw error.
for (const [key, handler] of Object.entries(ACTIONS)) {
  gladys.onAction(key, async (fields) => {
    try {
      return await handler(gladys, { fields, config });
    } catch (err) {
      if (err instanceof UserFacingError) return err.userMessage;
      throw err;
    }
  });
}

// --- Scene actions ------------------------------------------------------------------
for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
  gladys.onSceneAction(key, (fields) => handler(gladys, { fields, config }));
}

// --- Dashboard widgets ----------------------------------------------------------------
for (const [key, widget] of Object.entries(WIDGETS)) {
  gladys.onWidgetGet(key, (request) => widget.get(gladys, { ...request, config }));
  gladys.onWidgetAction(key, (actionKey, params, { settings }) =>
    widget.action(gladys, { actionKey, params, settings, config, refresh: refreshEverything }),
  );
}

// "Refresh" button: drop the cached BoM data, check the warnings now (scene
// triggers fire if anything changed), and have Gladys re-pull the weather.
async function refreshEverything() {
  clearCache();
  if (stopMonitor?.checkNow) {
    await stopMonitor.checkNow().catch((err) => logger.warn(`Check failed: ${err.message}`));
  }
  gladys.requestWeatherRefresh();
}

// --- Lifecycle ------------------------------------------------------------------------
function restartMonitor() {
  stopMonitor?.();
  stopMonitor = startMonitor(gladys, () => config, {
    // A warning appeared or ended, or the fire danger changed: the core's
    // weather-alert triggers and the dashboards should know now.
    onChange: () => {
      gladys.requestWeatherRefresh();
      refreshWidgets(gladys);
    },
  });
}

// Validate the location and report it in the Configuration screen.
async function reportConnectionStatus() {
  try {
    const location = await resolveLocation(gladys, config);
    logger.info(`Location: ${locationLabel(location)} (${location.geohash})`);
    await gladys.setConnectionStatus(true);
  } catch (err) {
    logger.warn(`Location check failed: ${err.message}`);
    await gladys
      .setConnectionStatus(
        false,
        err instanceof UserFacingError ? err.userMessage : T.bomUnavailable,
      )
      .catch(() => {});
  }
}

gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');
  config = normalizeConfig(newConfig);
  clearCache();
  restartMonitor();
  await reportConnectionStatus();
  gladys.requestWeatherRefresh();
  refreshWidgets(gladys);
});

gladys.on('connected', async () => {
  try {
    config = normalizeConfig(await gladys.getConfig());
    restartMonitor();
    await reportConnectionStatus();
    // Nudges sent while disconnected were dropped: re-sync open dashboards.
    refreshWidgets(gladys, Object.values(WIDGET_KEYS));
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
    await gladys
      .setConnectionStatus(false, {
        en: 'Initialization failed, check the integration logs.',
        fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
        de: 'Die Initialisierung ist fehlgeschlagen, prüfen Sie die Logs der Integration.',
        es: 'La inicialización falló, revise los registros de la integración.',
      })
      .catch(() => {});
  }
});

gladys.on('disconnected', () => {
  stopMonitor?.();
  stopMonitor = null;
});

gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  stopMonitor?.();
});

logger.info('Starting the Bureau of Meteorology integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
