/**
 * Custom High-Definition Vector SVGs for TermFlow Calendar Export
 * Authentic Apple, Google, Microsoft, and custom calendar visuals.
 */

// 1. Apple Calendar Brand Icon
export function AppleCalendarSVG({ size = 28, className = "" }) {
  const currentDay = new Date().getDate();
  const currentMonth = new Date().toLocaleDateString([], { month: "short" }).toUpperCase();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="4" y="6" width="40" height="36" rx="9" fill="white" />
      <path d="M4 15C4 10.0294 8.02944 6 13 6H35C39.9706 6 44 10.0294 44 15V17H4V15Z" fill="#FF3B30" />
      <text x="24" y="14" fill="white" fontSize="7" fontWeight="800" fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" textAnchor="middle" letterSpacing="0.5">
        {currentMonth}
      </text>
      <text x="24" y="34" fill="#1C1C1E" fontSize="17" fontWeight="700" fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" textAnchor="middle">
        {currentDay}
      </text>
      <rect x="4" y="6" width="40" height="36" rx="9" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
    </svg>
  );
}

// 2. Google Calendar Official 4-Color Icon
export function GoogleCalendarSVG({ size = 28, className = "" }) {
  const currentDay = new Date().getDate();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="48" height="48" rx="10" fill="#FFFFFF" fillOpacity="0.04" />
      {/* Blue base */}
      <path d="M36 8H12C9.79086 8 8 9.79086 8 12V36C8 38.2091 9.79086 40 12 40H36C38.2091 40 40 38.2091 40 36V12C40 9.79086 38.2091 8 36 8Z" fill="#4285F4" />
      {/* White center */}
      <rect x="14" y="14" width="20" height="20" rx="3" fill="white" />
      {/* Top Red Bar */}
      <path d="M12 8H36C38.2091 8 40 9.79086 40 12V14H8V12C8 9.79086 9.79086 8 12 8Z" fill="#EA4335" />
      {/* Yellow top-left fold accent */}
      <path d="M8 12C8 9.79086 9.79086 8 12 8H14V14H8V12Z" fill="#FBBC05" />
      {/* Green bottom-right accent */}
      <path d="M40 36C40 38.2091 38.2091 40 36 40H34V34H40V36Z" fill="#34A853" />
      {/* Day text */}
      <text x="24" y="29.5" fill="#4285F4" fontSize="13" fontWeight="800" fontFamily="Google Sans, Roboto, sans-serif" textAnchor="middle">
        {currentDay}
      </text>
    </svg>
  );
}

// 3. Microsoft Outlook Calendar Icon
export function OutlookCalendarSVG({ size = 28, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="6" y="8" width="36" height="32" rx="6" fill="#0078D4" />
      <rect x="10" y="12" width="28" height="24" rx="4" fill="#28A8EA" />
      <path d="M10 12H38V19H10V12Z" fill="#005A9E" />
      <circle cx="16" cy="15.5" r="1.5" fill="white" />
      <circle cx="24" cy="15.5" r="1.5" fill="white" />
      <circle cx="32" cy="15.5" r="1.5" fill="white" />
      {/* Calendar grid dots */}
      <rect x="14" y="23" width="4" height="3" rx="1" fill="white" />
      <rect x="22" y="23" width="4" height="3" rx="1" fill="white" />
      <rect x="30" y="23" width="4" height="3" rx="1" fill="white" />
      <rect x="14" y="29" width="4" height="3" rx="1" fill="white" />
      <rect x="22" y="29" width="4" height="3" rx="1" fill="white" />
      <rect x="30" y="29" width="4" height="3" rx="1" fill="white" fillOpacity="0.5" />
    </svg>
  );
}

// 4. Hero 3D Gradient Calendar Mark
export function Calendar3DGlowSVG({ size = 48, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="calGradMain" x1="8" y1="12" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="calGradHeader" x1="12" y1="12" x2="52" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>
        <filter id="calShadow" x="0" y="4" width="64" height="60" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#6366F1" floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter="url(#calShadow)">
        {/* Background plate */}
        <rect x="10" y="14" width="44" height="40" rx="12" fill="url(#calGradMain)" />
        {/* Glass sheen */}
        <rect x="11" y="15" width="42" height="38" rx="11" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" />
        {/* Top Header Bar */}
        <path d="M10 24C10 18.4772 14.4772 14 20 14H44C49.5228 14 54 18.4772 54 24V25H10V24Z" fill="url(#calGradHeader)" />
        {/* Binder rings */}
        <rect x="20" y="10" width="4" height="8" rx="2" fill="#FFFFFF" />
        <rect x="40" y="10" width="4" height="8" rx="2" fill="#FFFFFF" />
        {/* Checkmark icon in body */}
        <path d="M24 38L29 43L40 31" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Little decorative star */}
        <path d="M47 22L48.2 24.8L51 26L48.2 27.2L47 30L45.8 27.2L43 26L45.8 24.8L47 22Z" fill="#FDE047" />
      </g>
    </svg>
  );
}

// 5. Apple Device Vector Illustration for Setup Guide
export function AppleDeviceGuideSVG({ size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Phone chassis */}
      <rect x="16" y="8" width="48" height="64" rx="10" fill="#1C1C1E" stroke="#3A3A3C" strokeWidth="2" />
      {/* Screen */}
      <rect x="20" y="14" width="40" height="52" rx="6" fill="#2C2C2E" />
      {/* Notch */}
      <path d="M32 14H48V17C48 18.1046 47.1046 19 46 19H34C32.8954 19 32 18.1046 32 17V14Z" fill="#1C1C1E" />
      {/* iOS Modal Popup Card */}
      <rect x="24" y="24" width="32" height="34" rx="5" fill="#FFFFFF" />
      <rect x="26" y="27" width="28" height="4" rx="2" fill="#FF3B30" />
      <rect x="26" y="34" width="20" height="2" rx="1" fill="#8E8E93" />
      <rect x="26" y="38" width="24" height="2" rx="1" fill="#C7C7CC" />
      {/* "Add All" button badge */}
      <rect x="34" y="47" width="18" height="7" rx="3.5" fill="#007AFF" />
      <text x="43" y="52" fill="white" fontSize="4" fontWeight="bold" textAnchor="middle" fontFamily="-apple-system, sans-serif">
        Add All
      </text>
    </svg>
  );
}

// 6. Android Device Vector Illustration for Setup Guide
export function AndroidDeviceGuideSVG({ size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Phone chassis */}
      <rect x="16" y="8" width="48" height="64" rx="8" fill="#202124" stroke="#5F6368" strokeWidth="2" />
      {/* Screen */}
      <rect x="19" y="13" width="42" height="54" rx="5" fill="#303134" />
      {/* Camera punch hole */}
      <circle cx="40" cy="18" r="2" fill="#202124" />
      {/* Google Calendar card */}
      <rect x="23" y="25" width="34" height="32" rx="4" fill="#FFFFFF" />
      <rect x="26" y="28" width="12" height="3" rx="1.5" fill="#4285F4" />
      <rect x="26" y="34" width="22" height="2" rx="1" fill="#5F6368" />
      <rect x="26" y="38" width="18" height="2" rx="1" fill="#9AA0A6" />
      {/* "Save" button */}
      <rect x="36" y="46" width="18" height="7" rx="3.5" fill="#1A73E8" />
      <text x="45" y="51" fill="white" fontSize="4.2" fontWeight="bold" textAnchor="middle" fontFamily="Roboto, sans-serif">
        Save
      </text>
    </svg>
  );
}

// 7. Live Preview Calendar Event Card SVG Icon
export function CalendarEventBadgeSVG({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="17" rx="4" fill="url(#evBadgeGrad)" />
      <path d="M3 8H21" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
      <rect x="7" y="2" width="2" height="4" rx="1" fill="#FFFFFF" />
      <rect x="15" y="2" width="2" height="4" rx="1" fill="#FFFFFF" />
      <circle cx="8.5" cy="13.5" r="1.5" fill="#FFFFFF" />
      <circle cx="15.5" cy="13.5" r="1.5" fill="#FFFFFF" />
      <circle cx="12" cy="17" r="1.5" fill="#FFFFFF" />
      <defs>
        <linearGradient id="evBadgeGrad" x1="3" y1="4" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// 8. Custom Glowing Bell with Chime Waves SVG
export function GlowingAlarmBellSVG({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21S18 15 18 8Z"
        fill="url(#bellGrad)"
        stroke="#818CF8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.73 21A2 2 0 0 1 10.27 21" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 4L19.5 5.5" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 4L4.5 5.5" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="bellGrad" x1="6" y1="4" x2="18" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" stopOpacity="0.25" />
          <stop offset="1" stopColor="#8B5CF6" stopOpacity="0.6" />
        </linearGradient>
      </defs>
    </svg>
  );
}
