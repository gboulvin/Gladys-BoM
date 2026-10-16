// -----------------------------------------------------------------------------
// Translations.
//
// Gladys picks the user's language out of a multi-language object
// (`{ en, fr, de, es }`, `en` being the mandatory fallback), so every text the
// integration produces at runtime — action messages, widget labels, scene
// action outputs, connection statuses — is built from this catalog.
//
// The data the Bureau of Meteorology returns (forecast texts, warning titles,
// station names) only exists in English: it is passed through as is.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/** Build a multi-language object. */
export function L(en, fr, de, es) {
  return { en, fr, de, es };
}

/** Fill the `{name}` placeholders of every language of a multi-language object. */
export function fill(text, vars = {}) {
  const out = {};
  for (const [lang, value] of Object.entries(text)) {
    out[lang] = value
      .replace(/\{(\w+)\}/g, (match, name) =>
        vars[name] === undefined || vars[name] === null ? match : String(vars[name]),
      )
      .trim();
  }
  return out;
}

/** Pick one language of a multi-language object, English as fallback. */
export function pick(text, language) {
  const lang = String(language ?? 'en')
    .slice(0, 2)
    .toLowerCase();
  return text[lang] ?? text.en;
}

export const T = {
  // --- Connection status / errors ------------------------------------------
  noLocation: L(
    'No location: set one in the configuration, or give your Gladys house a position in Australia.',
    'Aucune localisation : renseignez-en une dans la configuration, ou positionnez votre maison Gladys en Australie.',
    'Kein Ort: Geben Sie einen in der Konfiguration an oder verorten Sie Ihr Gladys-Haus in Australien.',
    'Sin ubicación: indique una en la configuración o sitúe su casa de Gladys en Australia.',
  ),
  locationNotFound: L(
    'No Australian location matches "{query}".',
    'Aucun lieu australien ne correspond à « {query} ».',
    'Kein australischer Ort entspricht „{query}“.',
    'Ningún lugar australiano coincide con «{query}».',
  ),
  outsideAustralia: L(
    'This position is outside the area covered by the Bureau of Meteorology (Australia only).',
    'Cette position est hors de la zone couverte par le Bureau of Meteorology (Australie uniquement).',
    'Diese Position liegt außerhalb des vom Bureau of Meteorology abgedeckten Gebiets (nur Australien).',
    'Esta posición está fuera de la zona cubierta por el Bureau of Meteorology (solo Australia).',
  ),
  bomUnavailable: L(
    'The Bureau of Meteorology cannot be reached right now, check the integration logs.',
    "Le Bureau of Meteorology est injoignable pour le moment, consultez les logs de l'intégration.",
    'Das Bureau of Meteorology ist derzeit nicht erreichbar, prüfen Sie die Logs der Integration.',
    'El Bureau of Meteorology no está disponible ahora mismo, revise los registros de la integración.',
  ),

  // --- Manifest actions ------------------------------------------------------
  testOk: L(
    'Connected to the BoM: {location}, {temperature} °C observed at {station}.',
    'Connecté au BoM : {location}, {temperature} °C relevés à {station}.',
    'Mit dem BoM verbunden: {location}, {temperature} °C gemessen in {station}.',
    'Conectado al BoM: {location}, {temperature} °C observados en {station}.',
  ),
  testOkNoObs: L(
    'Connected to the BoM: {location} (no observation station nearby, forecasts only).',
    "Connecté au BoM : {location} (pas de station d'observation proche, prévisions uniquement).",
    'Mit dem BoM verbunden: {location} (keine Messstation in der Nähe, nur Vorhersagen).',
    'Conectado al BoM: {location} (sin estación de observación cercana, solo pronósticos).',
  ),
  searchResults: L(
    'Matches: {list}. Copy one into the Location field.',
    'Résultats : {list}. Copiez-en un dans le champ Localisation.',
    'Treffer: {list}. Kopieren Sie einen in das Feld Ort.',
    'Resultados: {list}. Copie uno en el campo Ubicación.',
  ),

  // --- Widgets -----------------------------------------------------------------
  temperature: L('Temperature', 'Température', 'Temperatur', 'Temperatura'),
  feelsLike: L('Feels like', 'Ressenti', 'Gefühlt', 'Sensación'),
  humidity: L('Humidity', 'Humidité', 'Feuchte', 'Humedad'),
  wind: L('Wind', 'Vent', 'Wind', 'Viento'),
  gust: L('Gusts', 'Rafales', 'Böen', 'Ráfagas'),
  rainSince9am: L('Rain since 9am', 'Pluie depuis 9h', 'Regen seit 9 Uhr', 'Lluvia desde 9h'),
  today: L('Today', "Aujourd'hui", 'Heute', 'Hoy'),
  tomorrow: L('Tomorrow', 'Demain', 'Morgen', 'Mañana'),
  fireDanger: L('Fire danger', "Danger d'incendie", 'Brandgefahr', 'Peligro de incendio'),
  uvIndex: L('Max UV index', 'Indice UV max', 'Max. UV-Index', 'Índice UV máx.'),
  rainChance: L('Chance of rain', 'Risque de pluie', 'Regenwahrscheinlichkeit', 'Prob. de lluvia'),
  nextHours: L(
    'Temperature, next 24 h',
    'Température, prochaines 24 h',
    'Temperatur, nächste 24 h',
    'Temperatura, próximas 24 h',
  ),
  observedAt: L(
    'Observed at {station} · {time}',
    'Relevé à {station} · {time}',
    'Gemessen in {station} · {time}',
    'Observado en {station} · {time}',
  ),
  forecastIssued: L(
    'Forecast for {location}',
    'Prévisions pour {location}',
    'Vorhersage für {location}',
    'Pronóstico para {location}',
  ),
  noWarnings: L(
    'No current warnings',
    'Aucune alerte en cours',
    'Keine aktuellen Warnungen',
    'Sin avisos vigentes',
  ),
  currentWarnings: L(
    'Current warnings',
    'Alertes en cours',
    'Aktuelle Warnungen',
    'Avisos vigentes',
  ),
  warningsFor: L(
    'Warnings for {location}',
    'Alertes pour {location}',
    'Warnungen für {location}',
    'Avisos para {location}',
  ),
  expires: L('Expires {time}', 'Expire {time}', 'Läuft ab {time}', 'Expira {time}'),
  refresh: L('Refresh', 'Actualiser', 'Aktualisieren', 'Actualizar'),
  refreshed: L(
    'BoM data refreshed.',
    'Données du BoM actualisées.',
    'BoM-Daten aktualisiert.',
    'Datos del BoM actualizados.',
  ),
  allWarnings: L('All BoM warnings', 'Toutes les alertes', 'Alle Warnungen', 'Todos los avisos'),
  major: L('Major', 'Majeure', 'Schwer', 'Mayor'),
  minor: L('Minor', 'Mineure', 'Gering', 'Menor'),
  unavailable: L('Unavailable', 'Indisponible', 'Nicht verfügbar', 'No disponible'),
};

// Australian Fire Danger Rating System (AFDRS) levels, normalized keys.
export const FIRE_DANGER_LABELS = {
  no_rating: L('No rating', 'Aucun niveau', 'Keine Einstufung', 'Sin clasificación'),
  moderate: L('Moderate', 'Modéré', 'Mäßig', 'Moderado'),
  high: L('High', 'Élevé', 'Hoch', 'Alto'),
  extreme: L('Extreme', 'Extrême', 'Extrem', 'Extremo'),
  catastrophic: L('Catastrophic', 'Catastrophique', 'Katastrophal', 'Catastrófico'),
};

// Warning categories (the `warning_type` filter of the scene triggers).
export const WARNING_CATEGORY_LABELS = {
  flood: L('Flood', 'Inondation', 'Hochwasser', 'Inundación'),
  thunderstorm: L('Severe thunderstorm', 'Orage violent', 'Schweres Gewitter', 'Tormenta severa'),
  severe_weather: L('Severe weather', 'Intempéries', 'Unwetter', 'Tiempo severo'),
  fire_weather: L(
    'Fire weather',
    'Conditions propices aux feux',
    'Feuerwetter',
    'Tiempo propicio a incendios',
  ),
  heatwave: L('Heatwave', 'Canicule', 'Hitzewelle', 'Ola de calor'),
  tropical_cyclone: L(
    'Tropical cyclone',
    'Cyclone tropical',
    'Tropischer Wirbelsturm',
    'Ciclón tropical',
  ),
  wind: L(
    'Wind (marine, coastal)',
    'Vent (marin, côtier)',
    'Wind (See, Küste)',
    'Viento (marino, costero)',
  ),
  cold: L(
    'Cold (sheep graziers, frost)',
    'Froid (éleveurs, gel)',
    'Kälte (Schafhalter, Frost)',
    'Frío (ganaderos, helada)',
  ),
  tsunami: L('Tsunami', 'Tsunami', 'Tsunami', 'Tsunami'),
  coastal: L(
    'Coastal hazard, hazardous surf',
    'Danger côtier, houle dangereuse',
    'Küstengefahr, gefährliche Brandung',
    'Peligro costero, oleaje peligroso',
  ),
  other: L('Other', 'Autre', 'Sonstige', 'Otro'),
};
