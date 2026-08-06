const WEATHER_CACHE_TTL = 30 * 60 * 1000;
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1/search';

function getIntensity(weatherCode) {
  if ([51, 56, 61, 66, 71, 80, 85].includes(weatherCode)) return 'light';
  if ([53, 63, 73, 81].includes(weatherCode)) return 'moderate';
  if ([55, 57, 65, 67, 75, 77, 82, 86, 95, 96, 99].includes(weatherCode)) return 'heavy';
  return 'moderate';
}

const WEATHER_DESC = {
  clear: '晴',
  cloudy: '多云',
  overcast: '阴',
  fog: '雾',
  drizzle: '毛毛雨',
  rain: '雨',
  snow: '雪',
  thunderstorm: '雷暴',
};

const WEATHER_EMOJI = {
  clear: '☀️',
  cloudy: '⛅',
  overcast: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  rain: '🌧️',
  snow: '❄️',
  thunderstorm: '⛈️',
};

const WEATHER_DETAIL_DEFS = [
  {
    key: 'condition',
    label: '天气',
    format: (data) => `${WEATHER_EMOJI[data.effect] || '🌤️'} ${WEATHER_DESC[data.effect] || '未知'}`,
  },
  {
    key: 'apparentTemperature',
    label: '体感',
    unit: '°C',
    format: (data) => `${Math.round(Number(data.apparentTemperature))}°C`,
  },
  {
    key: 'humidity',
    label: '湿度',
    unit: '%',
    format: (data) => `${Math.round(Number(data.humidity))}%`,
  },
  {
    key: 'windSpeed',
    label: '风速',
    unit: 'km/h',
    format: (data) => `${Math.round(Number(data.windSpeed))}km/h`,
  },
  {
    key: 'windDirection',
    label: '风向',
    unit: '°',
    format: (data) => `${Math.round(Number(data.windDirection))}°`,
  },
  {
    key: 'precipitation',
    label: '降水',
    unit: 'mm',
    format: (data) => `${Number(data.precipitation).toFixed(1)}mm`,
  },
  {
    key: 'cloudCover',
    label: '云量',
    unit: '%',
    format: (data) => `${Math.round(Number(data.cloudCover))}%`,
  },
  {
    key: 'pressureMsl',
    label: '气压',
    unit: 'hPa',
    format: (data) => `${Math.round(Number(data.pressureMsl))}hPa`,
  },
  {
    key: 'visibility',
    label: '能见度',
    unit: 'm',
    format: (data) => `${Math.round(Number(data.visibility))}m`,
  },
  {
    key: 'uvIndex',
    label: '紫外线',
    unit: '',
    format: (data) => `${Number(data.uvIndex).toFixed(1)}`,
  },
];

const INTENSITY_INDEX = {
  light: 0,
  moderate: 1,
  heavy: 2,
};

const WMO_VISUAL_MAP = {
  0: { effect: 'clear', intensity: 'moderate' },
  1: { effect: 'cloudy', intensity: 'light' },
  2: { effect: 'cloudy', intensity: 'moderate' },
  3: { effect: 'overcast', intensity: 'heavy' },
  45: { effect: 'fog', intensity: 'light' },
  48: { effect: 'fog', intensity: 'heavy' },
  51: { effect: 'drizzle', intensity: 'light' },
  53: { effect: 'drizzle', intensity: 'moderate' },
  55: { effect: 'drizzle', intensity: 'heavy' },
  56: { effect: 'drizzle', intensity: 'moderate', frozen: true },
  57: { effect: 'drizzle', intensity: 'heavy', frozen: true },
  61: { effect: 'rain', intensity: 'light' },
  63: { effect: 'rain', intensity: 'moderate' },
  65: { effect: 'rain', intensity: 'heavy' },
  66: { effect: 'rain', intensity: 'moderate', frozen: true },
  67: { effect: 'rain', intensity: 'heavy', frozen: true },
  71: { effect: 'snow', intensity: 'light' },
  73: { effect: 'snow', intensity: 'moderate' },
  75: { effect: 'snow', intensity: 'heavy' },
  77: { effect: 'snow', intensity: 'moderate', granular: true },
  80: { effect: 'rain', intensity: 'light', shower: true },
  81: { effect: 'rain', intensity: 'moderate', shower: true },
  82: { effect: 'rain', intensity: 'heavy', shower: true },
  85: { effect: 'snow', intensity: 'light', shower: true },
  86: { effect: 'snow', intensity: 'heavy', shower: true },
  95: { effect: 'thunderstorm', intensity: 'moderate' },
  96: { effect: 'thunderstorm', intensity: 'heavy', hail: true },
  99: { effect: 'thunderstorm', intensity: 'heavy', hail: true, severe: true },
};

function pickIntensityValue(value, intensity, fallback) {
  if (Array.isArray(value)) {
    const idx = INTENSITY_INDEX[intensity] ?? 1;
    return value[Math.min(value.length - 1, idx)] ?? fallback;
  }
  if (value && typeof value === 'object') {
    return value[intensity] ?? value.moderate ?? fallback;
  }
  return value ?? fallback;
}

function intensityScale(intensity) {
  return ({ light: 0.68, moderate: 1, heavy: 1.38 })[intensity] || 1;
}

const weather = {
  data: null,
  userCoords: null,
  cityName: null,
  displayEnabled: true,

  async init() {
    const wc = document.getElementById('weather-container');
    if (wc) wc.style.display = '';

    const stored = await Storage.get(['weatherDisplayEnabled']);
    this.displayEnabled = stored.weatherDisplayEnabled !== false;

    if (wc) wc.style.display = this.displayEnabled ? '' : 'none';

    weatherRenderer.init();

    const cached = await this._loadCache();
    if (cached) {
      this.data = cached;
      this._applyEffect();
    }

    if (this.displayEnabled) {
      this._refresh();
    }
  },

  async _refresh() {
    if (!this.displayEnabled) return;
    const coords = await this._getCoords();
    if (!coords) return;
    this.userCoords = coords;
    if (!this.displayEnabled) return;
    const raw = await this._fetchWeather(coords.latitude, coords.longitude);
    if (!raw) return;
    if (!this.displayEnabled) return;
    const visual = WMO_VISUAL_MAP[raw.current.weather_code] || { effect: 'clear', intensity: 'moderate' };
    this.data = {
      temperature: raw.current.temperature_2m,
      apparentTemperature: raw.current.apparent_temperature,
      humidity: raw.current.relative_humidity_2m,
      precipitation: raw.current.precipitation,
      weatherCode: raw.current.weather_code,
      windSpeed: raw.current.wind_speed_10m,
      windDirection: raw.current.wind_direction_10m,
      cloudCover: raw.current.cloud_cover,
      pressureMsl: raw.current.pressure_msl,
      visibility: raw.current.visibility,
      uvIndex: raw.current.uv_index,
      effect: visual.effect,
      intensity: visual.intensity || getIntensity(raw.current.weather_code),
      variant: visual,
    };
    await this._saveCache(this.data);
    if (!this.displayEnabled) return;
    this._applyEffect();
  },

  async _getCoords() {
    const stored = await Storage.get(['weatherCoords', 'weatherCityName']);
    if (stored.weatherCoords) {
      this.userCoords = stored.weatherCoords;
      this.cityName = stored.weatherCityName || '';
      return this.userCoords;
    }
    return null;
  },

  async _fetchWeather(lat, lng) {
    try {
      const url = `${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,pressure_msl,visibility,uv_index`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  },

  async _loadCache() {
    const data = await Storage.get(['weatherCache']);
    if (!data.weatherCache) return null;
    if (Date.now() - data.weatherCache.timestamp > WEATHER_CACHE_TTL) return null;
    return data.weatherCache.data;
  },

  async _saveCache(data) {
    await Storage.set({
      weatherCache: { data, timestamp: Date.now() },
    });
  },

  _applyEffect() {
    window.dispatchEvent(new CustomEvent('weather-update', {
      detail: this.data,
    }));
  },

  async setDisplayEnabled(enabled) {
    this.displayEnabled = !!enabled;
    await Storage.set({ weatherDisplayEnabled: this.displayEnabled });
    const wc = document.getElementById('weather-container');
    if (wc) wc.style.display = this.displayEnabled ? '' : 'none';
    if (this.displayEnabled) {
      if (this.data) {
        this._applyEffect();
      }
      this._refresh();
    }
  },

  _FC_PRIORITY: {
    PPLC: 10,
    PPLA: 9,
    PPLA2: 8,
    PPLA3: 7,
    PPLA4: 6,
    PPL: 3,
  },

  _FC_LABEL: {
    PPLC: '首都',
    PPLA: '省/直辖市',
    PPLA2: '市/地区',
    PPLA3: '县/区',
    PPLA4: '镇',
    PPL: '村镇',
  },

  async _fetchGeoResults(query) {
    const url = `${GEOCODING_BASE}?name=${encodeURIComponent(query)}&count=8&language=zh`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const json = await resp.json();
    if (!json.results) return null;
    return json.results;
  },

  async searchCities(query) {
    try {
      // Parallel search: original query + query with "市" (covers most Chinese cities)
      const [raw1, raw2] = await Promise.all([
        this._fetchGeoResults(query),
        query.length <= 4 ? this._fetchGeoResults(query + '市') : Promise.resolve(null),
      ]);

      const raw = [];
      const dedup = new Set();
      for (const batch of [raw1, raw2]) {
        if (!batch) continue;
        for (const r of batch) {
          const key = `${r.latitude},${r.longitude}`;
          if (!dedup.has(key)) { raw.push(r); dedup.add(key); }
        }
      }

      const results = raw
        .map(r => ({
          name: r.name,
          region: [r.admin1, r.admin2, r.country].filter(Boolean).join(', '),
          latitude: r.latitude,
          longitude: r.longitude,
          display: r.admin1 ? `${r.name}, ${r.admin1}` : r.name,
          level: this._FC_LABEL[r.feature_code] || '其他',
          _priority: this._FC_PRIORITY[r.feature_code] || 1,
          _population: r.population || 0,
        }))
        .sort((a, b) => b._priority - a._priority || b._population - a._population)
        .slice(0, 5);

      return results;
    } catch {
      return [];
    }
  },

  async setCityExact(name, latitude, longitude, displayName) {
    this.cityName = displayName || name;
    this.userCoords = { latitude, longitude };
    await Storage.set({ weatherCoords: { latitude, longitude }, weatherCityName: this.cityName });
    await this._refresh();
    return true;
  },
};

// ============ Rendering ============

const weatherRenderer = {
  _initialized: false,

  init() {
    if (this._initialized) return;
    this._initialized = true;
    window.addEventListener('weather-update', (e) => {
      this.render(e.detail);
    });
  },

  render(data) {
    if (!data) return;
    const tempEl = document.getElementById('weather-temp');
    if (tempEl) tempEl.textContent = `${WEATHER_EMOJI[data.effect] || '🌤️'} ${data.temperature}°`;

    const detailsEl = document.getElementById('weather-details');
    if (detailsEl) {
      const rows = [];
      for (const def of WEATHER_DETAIL_DEFS) {
        if (!def || typeof def.format !== 'function') continue;
        let value = '';
        try {
          value = def.format(data);
        } catch {
          value = '';
        }
        if (!value || value === 'NaN' || value === 'NaN°C' || value === 'NaN%') continue;
        rows.push(`<span class="weather-detail-item" data-key="${def.key}"><span class="weather-detail-label">${def.label}</span><span class="weather-detail-value">${value}</span></span>`);
      }
      detailsEl.innerHTML = rows.join('');
      detailsEl.style.display = rows.length ? 'flex' : 'none';
    }
  },
};
