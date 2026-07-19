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
