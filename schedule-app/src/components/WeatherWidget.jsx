import { Clock, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog } from "lucide-react";

function wIcon(code) {
  if (code === 0) return Sun;
  if (code <= 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 55) return CloudDrizzle;
  if (code <= 67) return CloudRain;
  if (code <= 77) return CloudSnow;
  if (code <= 82) return CloudRain;
  return CloudLightning;
}

export default function WeatherWidget({ now, weather }) {
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const WIcon = weather ? wIcon(weather.code) : null;
  
  return (
    <div className="att-weather" style={{ display: 'flex' }}>
      <span className="att-weather-time"><Clock size={12} />{time}</span>
      {WIcon && weather && <span className="att-weather-wx"><WIcon size={12} />{weather.temp}°C</span>}
    </div>
  );
}
