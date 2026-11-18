/**
 * Custom High-Definition Vector SVGs for TermFlow
 * Authentic brand emblems, vehicle vector art, and action badges.
 */

// 1. Official WhatsApp Vector Emblem
export function WhatsAppBrandSVG({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="waGrad" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2FE064" />
          <stop offset="1" stopColor="#1DA851" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="url(#waGrad)" />
      <path
        d="M23.1 19.8c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.5.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5s-.7-1.7-.9-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.8 0 1.7 1.2 3.3 1.4 3.5.2.2 2.4 3.7 5.8 5.1 2.8 1.2 3.4 1 4 .9.7-.1 2.1-.8 2.4-1.7.3-.8.3-1.6.2-1.7-.1-.2-.3-.3-.6-.4z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

// 2. High-End Apple/iOS Style Share Arrow & Tray
export function ShareGradientSVG({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="shareArrowGrad" x1="12" y1="2" x2="12" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      {/* Launch Arrow */}
      <path d="M12 3L6.5 8.5M12 3L17.5 8.5M12 3V15" stroke="url(#shareArrowGrad)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Receiving Tray */}
      <path d="M5 12V18.5C5 19.88 6.12 21 7.5 21H16.5C17.88 21 19 19.88 19 18.5V12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

// 3. Premium Airport / City Cab Taxi
export function PremiumCabSVG({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="cabBodyGrad" x1="14" y1="6" x2="14" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBBF24" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="glassGrad" x1="14" y1="8" x2="14" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" stopOpacity="0.85" />
          <stop offset="1" stopColor="#0284C7" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      {/* Taxi Roof Sign */}
      <rect x="10.5" y="4" width="7" height="3" rx="1.2" fill="#18181B" />
      <rect x="12" y="4.5" width="4" height="2" rx="0.6" fill="#FEF08A" />
      {/* Main Car Body */}
      <path d="M5.5 13.5L7.2 8.4C7.6 7.3 8.6 6.5 9.8 6.5H18.2C19.4 6.5 20.4 7.3 20.8 8.4L22.5 13.5C23.9 14.1 25 15.4 25 17V21.5C25 22.3 24.3 23 23.5 23H22C21.2 23 20.5 22.3 20.5 21.5V20.5H7.5V21.5C7.5 22.3 6.8 23 6 23H4.5C3.7 23 3 22.3 3 21.5V17C3 15.4 4.1 14.1 5.5 13.5Z" fill="url(#cabBodyGrad)" />
      {/* Windshield */}
      <path d="M8.2 8.5L7 13H21L19.8 8.5C19.6 7.9 19 7.5 18.3 7.5H9.7C9 7.5 8.4 7.9 8.2 8.5Z" fill="url(#glassGrad)" />
      {/* Headlights */}
      <circle cx="6" cy="17" r="1.8" fill="#FEF08A" />
      <circle cx="22" cy="17" r="1.8" fill="#FEF08A" />
      {/* Grille */}
      <rect x="10" y="16.5" width="8" height="2" rx="1" fill="#18181B" opacity="0.75" />
      {/* Wheels */}
      <rect x="5" y="21" width="3.5" height="3" rx="1.5" fill="#18181B" />
      <rect x="19.5" y="21" width="3.5" height="3" rx="1.5" fill="#18181B" />
    </svg>
  );
}

// 4. Iconic Indian Auto-Rickshaw Vector
export function PremiumAutoSVG({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="autoRoof" x1="14" y1="4" x2="14" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBBF24" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="autoBody" x1="14" y1="12" x2="14" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      {/* Yellow Canopy */}
      <path d="M6 7.5C6 5.8 7.3 4.5 9 4.5H19C20.7 4.5 22 5.8 22 7.5L23 11H5L6 7.5Z" fill="url(#autoRoof)" />
      {/* Green Metal Body */}
      <path d="M5 11H23L24 16.5C24 18.4 22.4 20 20.5 20H7.5C5.6 20 4 18.4 4 16.5L5 11Z" fill="url(#autoBody)" />
      {/* Windshield Frame & Glass */}
      <rect x="7" y="8" width="14" height="4.5" rx="1.2" fill="#BAE6FD" opacity="0.9" />
      {/* Center Headlight */}
      <circle cx="14" cy="15.5" r="2.2" fill="#FEF08A" stroke="#CA8A04" strokeWidth="0.8" />
      {/* Front Wheel */}
      <circle cx="14" cy="22.5" r="2.5" fill="#18181B" />
      <circle cx="14" cy="22.5" r="1.1" fill="#71717A" />
      {/* Side Mirror Accents */}
      <circle cx="4.5" cy="10" r="1.2" fill="#18181B" />
      <circle cx="23.5" cy="10" r="1.2" fill="#18181B" />
    </svg>
  );
}

// 5. Transit Coach Bus Vector
export function PremiumBusSVG({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="busBodyGrad" x1="14" y1="4" x2="14" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      {/* Bus Body */}
      <rect x="5" y="4.5" width="18" height="17" rx="3.5" fill="url(#busBodyGrad)" />
      {/* Windshield */}
      <rect x="7" y="6.5" width="14" height="6" rx="1.8" fill="#E0F2FE" />
      {/* Destination Board */}
      <rect x="9.5" y="5" width="9" height="1.2" rx="0.5" fill="#FEF08A" />
      {/* Headlights */}
      <circle cx="8" cy="18" r="1.5" fill="#FEF08A" />
      <circle cx="20" cy="18" r="1.5" fill="#FEF08A" />
      {/* Grille */}
      <line x1="11" y1="18" x2="17" y2="18" stroke="#064E3B" strokeWidth="1.5" strokeLinecap="round" />
      {/* Wheels */}
      <rect x="7" y="21.5" width="3" height="3" rx="1.2" fill="#18181B" />
      <rect x="18" y="21.5" width="3" height="3" rx="1.2" fill="#18181B" />
    </svg>
  );
}

// 6. High-Speed Locomotive / Bullet Train
export function PremiumTrainSVG({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="trainGrad" x1="14" y1="3" x2="14" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
      </defs>
      {/* Train Aerodynamic Nose */}
      <path d="M7 6.5C7 4.5 9.5 3.5 14 3.5C18.5 3.5 21 4.5 21 6.5V18.5C21 20.4 19.4 22 17.5 22H10.5C8.6 22 7 20.4 7 18.5V6.5Z" fill="url(#trainGrad)" />
      {/* Aerodynamic Windshield */}
      <path d="M8.5 7.5C8.5 6 10.5 5 14 5C17.5 5 19.5 6 19.5 7.5V11.5H8.5V7.5Z" fill="#38BDF8" opacity="0.95" />
      {/* Center Beam Light */}
      <circle cx="14" cy="17" r="2.2" fill="#FEF08A" />
      {/* Twin Buffer Lights */}
      <circle cx="9.5" cy="18.5" r="1.2" fill="#EF4444" />
      <circle cx="18.5" cy="18.5" r="1.2" fill="#EF4444" />
      {/* Tracks Base */}
      <path d="M6 23.5H22" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="23.5" x2="7.5" y2="25.5" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="19" y1="23.5" x2="20.5" y2="25.5" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// 7. Commercial Flight / Airport Departure
export function PremiumFlightSVG({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="flightGrad" x1="14" y1="3" x2="14" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      <path
        d="M13.2 4.1C13.6 3.3 14.4 3.3 14.8 4.1L16.6 8.5L24.5 13.2C25.3 13.7 25.1 14.5 24.2 14.5H17.2L16.2 21.2L18.4 23.4C18.8 23.8 18.5 24.5 17.8 24.5H10.2C9.5 24.5 9.2 23.8 9.6 23.4L11.8 21.2L10.8 14.5H3.8C2.9 14.5 2.7 13.7 3.5 13.2L11.4 8.5L13.2 4.1Z"
        fill="url(#flightGrad)"
      />
    </svg>
  );
}

// 8. Vehicle Passenger Seats Available Vector
export function PremiumSeatsSVG({ size = 14, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {/* Left Seat */}
      <rect x="2.5" y="3" width="6" height="3" rx="1.5" fill="currentColor" opacity="0.9" />
      <rect x="2" y="7" width="7" height="8.5" rx="2.5" fill="currentColor" opacity="0.9" />
      {/* Right Seat */}
      <rect x="11.5" y="3" width="6" height="3" rx="1.5" fill="currentColor" opacity="0.9" />
      <rect x="11" y="7" width="7" height="8.5" rx="2.5" fill="currentColor" opacity="0.9" />
      {/* Cushion baseline */}
      <rect x="1.5" y="14" width="17" height="3" rx="1.5" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

// 9. Academic Class Representative Crest / Badge
export function ClassRepBadgeSVG({ size = 32, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="crShieldGrad" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      {/* Rounded Crest Plate */}
      <rect x="3" y="3" width="30" height="30" rx="9" fill="url(#crShieldGrad)" />
      <rect x="3.5" y="3.5" width="29" height="29" rx="8.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      {/* Academic Cap / Mortarboard */}
      <path d="M18 10L10 14.5L18 19L26 14.5L18 10Z" fill="#FFFFFF" />
      <path d="M13 16.5V20.5C13 22.5 15.2 24 18 24C20.8 24 23 22.5 23 20.5V16.5" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
      {/* Golden Star Accent */}
      <path d="M26 22L26.7 23.5L28.3 23.8L27.1 25L27.4 26.6L26 25.8L24.6 26.6L24.9 25L23.7 23.8L25.3 23.5L26 22Z" fill="#FBBF24" />
    </svg>
  );
}

// 10. Calendar Out-of-Office Export SVG Badge
export function CalendarExportSVG({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="calBgGrad" x1="3" y1="4" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      {/* Calendar Plate */}
      <rect x="3" y="4" width="18" height="17" rx="4" fill="url(#calBgGrad)" />
      {/* Header bar */}
      <path d="M3 8.5H21" stroke="#93C5FD" strokeWidth="1.5" />
      {/* Rings */}
      <rect x="7" y="2" width="2" height="4" rx="1" fill="#FFFFFF" />
      <rect x="15" y="2" width="2" height="4" rx="1" fill="#FFFFFF" />
      {/* Arrow down / export into device */}
      <path d="M12 12V17M12 17L9.5 14.5M12 17L14.5 14.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 11. Tropical Break / Vacation Palm Tree SVG
export function TropicalBreakSVG({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {/* Sun glow */}
      <circle cx="16.5" cy="7.5" r="3.5" fill="#FBBF24" />
      {/* Palm Trunk */}
      <path d="M8 20C9.5 16 11 12 10.5 8" stroke="#B45309" strokeWidth="2.2" strokeLinecap="round" />
      {/* Palm Fronds */}
      <path d="M10.5 8C8.5 6.5 5 7.5 4 10" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.5 8C11.5 5.5 14 5 16.5 6.5" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.5 8C12 9.5 14 11 15 13" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.5 8C8.5 9 6.5 11 6 13.5" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
      {/* Island Dune */}
      <path d="M3 20.5C6 19.5 12 19 21 21" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 12. Hero Empty State Illustration: Campus Travel & Highway
export function TravelIllustrationSVG({ size = 110, className = "" }) {
  return (
    <svg width={size} height={Math.round(size * 0.75)} viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="skyGrad" x1="80" y1="10" x2="80" y2="85" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818CF8" stopOpacity="0.18" />
          <stop offset="1" stopColor="#38BDF8" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="roadGrad" x1="80" y1="75" x2="80" y2="115" gradientUnits="userSpaceOnUse">
          <stop stopColor="#334155" />
          <stop offset="1" stopColor="#1E293B" />
        </linearGradient>
      </defs>
      {/* Sky Aura */}
      <rect x="10" y="8" width="140" height="70" rx="14" fill="url(#skyGrad)" />
      {/* Mountain Silhouettes */}
      <path d="M15 78L45 42L75 78H15Z" fill="#CBD5E1" opacity="0.3" />
      <path d="M60 78L95 35L130 78H60Z" fill="#94A3B8" opacity="0.35" />
      {/* Airplane Contrail in Sky */}
      <path d="M30 32C65 24 100 20 135 16" stroke="#38BDF8" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
      <path d="M136 15L144 14L141 21L138 18L132 18L136 15Z" fill="#38BDF8" />
      {/* Highway / Road */}
      <path d="M25 115L65 75H95L135 115H25Z" fill="url(#roadGrad)" />
      {/* Road Center Dash */}
      <line x1="80" y1="78" x2="80" y2="86" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
      <line x1="80" y1="92" x2="80" y2="103" stroke="#FEF08A" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="80" y1="109" x2="80" y2="115" stroke="#FEF08A" strokeWidth="3" strokeLinecap="round" />
      {/* Sleek Taxi on Road */}
      <rect x="68" y="72" width="24" height="13" rx="4" fill="#F59E0B" />
      <path d="M72 72L74.5 68H85.5L88 72H72Z" fill="#38BDF8" opacity="0.9" />
      <circle cx="73" cy="85" r="3" fill="#0F172A" />
      <circle cx="87" cy="85" r="3" fill="#0F172A" />
      <rect x="76.5" y="66" width="7" height="2.5" rx="1" fill="#18181B" />
    </svg>
  );
}
