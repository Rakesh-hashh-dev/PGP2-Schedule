import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog } from "lucide-react";

function wIcon(code) {
  if (code === 0) return { icon: Sun, color: "#F59E0B" }; // Amber
  if (code <= 3) return { icon: Cloud, color: "#9CA3AF" }; // Gray
  if (code <= 48) return { icon: CloudFog, color: "#94A3B8" }; // Slate
  if (code <= 55) return { icon: CloudDrizzle, color: "#60A5FA" }; // Light Blue
  if (code <= 67) return { icon: CloudRain, color: "#3B82F6" }; // Blue
  if (code <= 77) return { icon: CloudSnow, color: "#93C5FD" }; // Very Light Blue
  if (code <= 82) return { icon: CloudRain, color: "#3B82F6" };
  return { icon: CloudLightning, color: "#8B5CF6" }; // Purple
}

export default function WeatherWidget({ now, weather }) {
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  const day = now.toLocaleDateString([], { weekday: "long" });
  const wData = weather ? wIcon(weather.code) : null;
  const WIcon = wData ? wData.icon : null;
  
  return (
    <button className="att-weather group">
      <div className="att-weather-slider">
        {/* Default view: Time and Day */}
        <span className="att-weather-time">
          {time} · {day}
        </span>

        {/* Hover view: Weather */}
        <span className="att-weather-wx">
          {WIcon && weather ? (
            <>
              <WIcon size={14} style={{ color: wData.color }} />
              {weather.temp}°C
            </>
          ) : (
            "No weather data"
          )}
        </span>
      </div>
    </button>
  );
}
