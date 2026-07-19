import { wIcon } from "../lib/weather.js";

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
