import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog } from "lucide-react";

// WMO weather code → { icon, color }. Shared by WeatherWidget and
// TomorrowSummary; lives outside the component files so Fast Refresh works.
export function wIcon(code) {
  if (code === 0) return { icon: Sun, color: "#F59E0B" }; // Amber
  if (code <= 3) return { icon: Cloud, color: "#9CA3AF" }; // Gray
  if (code <= 48) return { icon: CloudFog, color: "#94A3B8" }; // Slate
  if (code <= 55) return { icon: CloudDrizzle, color: "#60A5FA" }; // Light Blue
  if (code <= 67) return { icon: CloudRain, color: "#3B82F6" }; // Blue
  if (code <= 77) return { icon: CloudSnow, color: "#93C5FD" }; // Very Light Blue
  if (code <= 82) return { icon: CloudRain, color: "#3B82F6" };
  return { icon: CloudLightning, color: "#8B5CF6" }; // Purple
}

/**
 * Multi-model weather consensus fetcher for Sambalpur, Odisha, India.
 * Compares European ECMWF IFS model, global ensemble/radar best-match,
 * and optional WeatherAPI.com (if VITE_WEATHER_API_KEY is configured).
 */
export async function fetchConsensusWeather() {
  const lat = 21.4669;
  const lon = 83.9812;
  const weatherApiKey = typeof import.meta !== "undefined" ? import.meta.env?.VITE_WEATHER_API_KEY : null;

  // 1. Fetch multi-model ensemble (ECMWF IFS + Best-Match) from Open-Meteo
  const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,precipitation_sum&temperature_unit=celsius&timezone=Asia%2FKolkata&forecast_days=2&models=ecmwf_ifs025,best_match`;

  const openMeteoPromise = fetch(openMeteoUrl)
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null);

  // 2. Fetch WeatherAPI if API key is provided
  const weatherApiPromise = weatherApiKey
    ? fetch(`https://api.weatherapi.com/v1/forecast.json?key=${weatherApiKey}&q=${lat},${lon}&days=2&aqi=no&alerts=no`)
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null)
    : Promise.resolve(null);

  const [omData, wapiData] = await Promise.all([openMeteoPromise, weatherApiPromise]);

  if (!omData?.daily && !wapiData?.forecast) return null;

  // Extract ECMWF data
  const ecmwfCode = omData?.daily?.weather_code_ecmwf_ifs025?.[1] ?? omData?.daily?.weather_code?.[1];
  const ecmwfProb = omData?.daily?.precipitation_probability_max_ecmwf_ifs025?.[1] ?? 0;
  const ecmwfRain = omData?.daily?.precipitation_sum_ecmwf_ifs025?.[1] ?? 0;
  const ecmwfMax = omData?.daily?.temperature_2m_max_ecmwf_ifs025?.[1];
  const ecmwfMin = omData?.daily?.temperature_2m_min_ecmwf_ifs025?.[1];

  // Extract Best-Match data
  const bestCode = omData?.daily?.weather_code_best_match?.[1];
  const bestProb = omData?.daily?.precipitation_probability_max_best_match?.[1] ?? 0;
  const bestRain = omData?.daily?.precipitation_sum_best_match?.[1] ?? 0;
  const bestMax = omData?.daily?.temperature_2m_max_best_match?.[1];
  const bestMin = omData?.daily?.temperature_2m_min_best_match?.[1];

  // Extract WeatherAPI data if available
  const wapiTomorrow = wapiData?.forecast?.forecastday?.[1]?.day;
  const wapiRainChance = wapiTomorrow?.daily_chance_of_rain ?? 0;
  const wapiPrecipMm = wapiTomorrow?.totalprecip_mm ?? 0;
  const wapiMax = wapiTomorrow?.maxtemp_c;
  const wapiMin = wapiTomorrow?.mintemp_c;

  // Consensus Temperature
  const validMaxTemps = [ecmwfMax, bestMax, wapiMax].filter(t => typeof t === "number" && !isNaN(t));
  const validMinTemps = [ecmwfMin, bestMin, wapiMin].filter(t => typeof t === "number" && !isNaN(t));

  const tomorrowMax = validMaxTemps.length ? Math.round(validMaxTemps.reduce((a, b) => a + b, 0) / validMaxTemps.length) : 31;
  const tomorrowMin = validMinTemps.length ? Math.round(validMinTemps.reduce((a, b) => a + b, 0) / validMinTemps.length) : 24;

  // Consensus Rain Chance & Sum
  const maxRainProb = Math.max(ecmwfProb, bestProb, wapiRainChance);
  const maxRainSum = Math.max(ecmwfRain, bestRain, wapiPrecipMm);

  // Model comparison & condition arbitration:
  // Severe convective storm check
  const hasStormSignal = (ecmwfCode >= 95 || bestCode >= 95) && maxRainProb >= 35;
  // Genuine rain requires agreement OR high probability (>= 40%) and measurable rainfall (>= 1.0mm)
  const hasGenuineRain =
    !hasStormSignal &&
    ((ecmwfCode >= 51 && bestCode >= 51 && maxRainProb >= 40 && maxRainSum >= 1.0) ||
      (maxRainProb >= 60 && maxRainSum >= 2.0));

  let finalTomorrowCode;
  if (hasStormSignal) {
    finalTomorrowCode = 95; // Thunderstorm
  } else if (hasGenuineRain) {
    finalTomorrowCode = ecmwfCode >= 61 || bestCode >= 61 ? 61 : 51; // Rain showers / Drizzle
  } else {
    // If no genuine rain, pick clearest agreement between models
    if (ecmwfCode != null && ecmwfCode <= 3) {
      finalTomorrowCode = ecmwfCode;
    } else if (bestCode != null && bestCode <= 3) {
      finalTomorrowCode = bestCode;
    } else {
      finalTomorrowCode = 1; // Default to partly cloudy / clear
    }
  }

  // Current weather
  const currentTemp = Math.round(wapiData?.current?.temp_c ?? omData?.current?.temperature_2m ?? 26);
  const currentCode = omData?.current?.weather_code ?? 0;

  // Today's extremes
  const todayMax = Math.round(omData?.daily?.temperature_2m_max_ecmwf_ifs025?.[0] ?? omData?.daily?.temperature_2m_max?.[0] ?? 30);
  const todayMin = Math.round(omData?.daily?.temperature_2m_min_ecmwf_ifs025?.[0] ?? omData?.daily?.temperature_2m_min?.[0] ?? 23);
  const todayCode = omData?.daily?.weather_code_ecmwf_ifs025?.[0] ?? omData?.daily?.weather_code?.[0] ?? 0;

  return {
    temp: currentTemp,
    code: currentCode,
    today: {
      max: todayMax,
      min: todayMin,
      code: todayCode,
    },
    tomorrow: {
      max: tomorrowMax,
      min: tomorrowMin,
      code: finalTomorrowCode,
      rainProb: maxRainProb,
      rainSum: maxRainSum,
      source: wapiData ? "ECMWF & WeatherAPI Consensus" : "ECMWF & Multi-Model Consensus",
    },
  };
}
