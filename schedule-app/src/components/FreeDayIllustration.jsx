
/**
 * FreeDayIllustration
 * 
 * High-performance, vector-crafted weather illustration system for empty/free-day states.
 * Uses scalable SVG with gradient definitions and hardware-accelerated CSS animations.
 *
 * @param {Object} props
 * @param {"clear"|"cloudy"|"rain"|"storm"} props.kind - Weather kind
 * @param {boolean} [props.isNight=false] - Whether it is night time
 * @param {string} [props.className=""] - Optional extra class names
 */
export default function FreeDayIllustration({ kind = "clear", isNight = false, className = "" }) {
  return (
    <div className={`fdi-root fdi-${kind} ${isNight ? "fdi-night" : "fdi-day"} ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 220 140"
        className="fdi-svg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Sun gradients */}
          <radialGradient id="fdiSunGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFF7ED" />
            <stop offset="35%" stopColor="#FDE047" />
            <stop offset="80%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </radialGradient>
          <radialGradient id="fdiSunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#FBBF24" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#FDE047" stopOpacity="0" />
          </radialGradient>

          {/* Moon gradients */}
          <radialGradient id="fdiMoonGrad" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#E0E7FF" />
            <stop offset="85%" stopColor="#C7D2FE" />
            <stop offset="100%" stopColor="#A5B4FC" />
          </radialGradient>
          <radialGradient id="fdiMoonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#818CF8" stopOpacity="0.4" />
            <stop offset="65%" stopColor="#6366F1" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
          </radialGradient>

          {/* Cloud gradients */}
          <linearGradient id="fdiCloudFrontGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>
          <linearGradient id="fdiCloudDarkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>
          <linearGradient id="fdiStormCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#64748B" />
            <stop offset="50%" stopColor="#475569" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="fdiStormCloudBackGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>

          {/* Rain gradient */}
          <linearGradient id="fdiRainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#93C5FD" stopOpacity="0" />
            <stop offset="40%" stopColor="#60A5FA" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="fdiStormRainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#A5B4FC" stopOpacity="0" />
            <stop offset="50%" stopColor="#818CF8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="1" />
          </linearGradient>

          {/* Lightning gradient */}
          <linearGradient id="fdiLightningGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>

          {/* Filters for soft atmospheric glow */}
          <filter id="fdiGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fdiLightningGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="fdiCloudShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* ─── SCENE: CLEAR DAY ─── */}
        {kind === "clear" && !isNight && (
          <g className="fdi-scene-clear-day">
            {/* Ambient sun glow */}
            <circle cx="110" cy="62" r="54" fill="url(#fdiSunGlow)" className="fdi-anim-pulse" />
            
            {/* Rotating sun rays */}
            <g className="fdi-anim-spin" style={{ transformOrigin: "110px 62px" }}>
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                <line
                  key={angle}
                  x1="110"
                  y1="24"
                  x2="110"
                  y2="16"
                  stroke="#FBBF24"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  opacity="0.75"
                  transform={`rotate(${angle} 110 62)`}
                />
              ))}
            </g>

            {/* Main Sun Body */}
            <circle cx="110" cy="62" r="28" fill="url(#fdiSunGrad)" filter="url(#fdiGlowFilter)" />

            {/* Subtle smiling eye-sparkles / sun specular */}
            <circle cx="102" cy="54" r="3.5" fill="#FFFFFF" opacity="0.65" />
            <circle cx="118" cy="54" r="2.5" fill="#FFFFFF" opacity="0.45" />

            {/* Floating gentle clouds */}
            <path
              d="M36,78 C36,71.4 41.4,66 48,66 C49.2,66 50.4,66.2 51.5,66.6 C53.5,60.4 59.3,56 66.2,56 C74.8,56 81.8,62.7 82.2,71.2 C85.6,72.4 88,75.6 88,79.5 C88,84.7 83.7,89 78.5,89 L47,89 C40.9,89 36,84.1 36,78 Z"
              fill="url(#fdiCloudFrontGrad)"
              opacity="0.82"
              filter="url(#fdiCloudShadow)"
              className="fdi-anim-drift-left"
            />
            <path
              d="M148,84 C148,78.5 152.5,74 158,74 C159,74 160,74.2 161,74.5 C162.7,69.5 167.5,66 173.2,66 C180.4,66 186.2,71.5 186.6,78.6 C189.5,79.6 191.5,82.3 191.5,85.5 C191.5,89.6 188.1,93 184,93 L157,93 C152,93 148,89 148,84 Z"
              fill="url(#fdiCloudFrontGrad)"
              opacity="0.75"
              filter="url(#fdiCloudShadow)"
              className="fdi-anim-drift-right"
            />

            {/* Twinkle golden sparkles */}
            <g className="fdi-anim-twinkle fdi-delay-1">
              <path d="M72,32 L74,38 L80,40 L74,42 L72,48 L70,42 L64,40 L70,38 Z" fill="#F59E0B" />
            </g>
            <g className="fdi-anim-twinkle fdi-delay-2">
              <path d="M152,34 L153.5,38 L157.5,39.5 L153.5,41 L152,45 L150.5,41 L146.5,39.5 L150.5,38 Z" fill="#FBBF24" />
            </g>
            <g className="fdi-anim-twinkle fdi-delay-3">
              <path d="M110,108 L111.5,112 L115.5,113.5 L111.5,115 L110,119 L108.5,115 L104.5,113.5 L108.5,112 Z" fill="#F59E0B" opacity="0.8" />
            </g>
          </g>
        )}

        {/* ─── SCENE: CLEAR NIGHT ─── */}
        {kind === "clear" && isNight && (
          <g className="fdi-scene-clear-night">
            {/* Ambient moon halo */}
            <circle cx="108" cy="62" r="50" fill="url(#fdiMoonGlow)" className="fdi-anim-pulse" />

            {/* Glowing Moon */}
            <g className="fdi-anim-float" style={{ transformOrigin: "108px 62px" }}>
              <path
                d="M96,36 C112,36 125,49 125,65 C125,81 112,94 96,94 C93,94 90.1,93.5 87.4,92.6 C97.2,88.9 104,79.5 104,68.5 C104,57.5 97.2,48.1 87.4,44.4 C90.1,43.5 93,36 96,36 Z"
                fill="url(#fdiMoonGrad)"
                filter="url(#fdiGlowFilter)"
              />
              {/* Moon craters */}
              <circle cx="106" cy="55" r="3.2" fill="#94A3B8" opacity="0.3" />
              <circle cx="112" cy="72" r="4.5" fill="#94A3B8" opacity="0.25" />
              <circle cx="115" cy="60" r="2.2" fill="#94A3B8" opacity="0.2" />
            </g>

            {/* Starfield */}
            <g className="fdi-anim-twinkle fdi-delay-1">
              <path d="M52,42 L54,47 L59,49 L54,51 L52,56 L50,51 L45,49 L50,47 Z" fill="#E0E7FF" />
            </g>
            <g className="fdi-anim-twinkle fdi-delay-2">
              <path d="M168,44 L170,48 L174,50 L170,52 L168,56 L166,52 L162,50 L166,48 Z" fill="#E0E7FF" />
            </g>
            <g className="fdi-anim-twinkle fdi-delay-3">
              <circle cx="70" cy="76" r="2" fill="#C7D2FE" />
              <circle cx="156" cy="78" r="2" fill="#C7D2FE" />
              <circle cx="140" cy="30" r="2" fill="#A5B4FC" />
              <circle cx="82" cy="28" r="1.5" fill="#C7D2FE" />
              <circle cx="128" cy="98" r="1.8" fill="#E0E7FF" />
            </g>

            {/* Shooting Star */}
            <line
              x1="30"
              y1="22"
              x2="65"
              y2="38"
              stroke="url(#fdiRainGrad)"
              strokeWidth="2"
              strokeLinecap="round"
              className="fdi-anim-shooting-star"
            />
          </g>
        )}

        {/* ─── SCENE: CLOUDY ─── */}
        {kind === "cloudy" && (
          <g className="fdi-scene-cloudy">
            {/* Sun or Moon peeking from behind */}
            {!isNight ? (
              <circle cx="132" cy="46" r="22" fill="url(#fdiSunGrad)" opacity="0.95" className="fdi-anim-pulse" />
            ) : (
              <path
                d="M128,30 C138,30 146,38 146,48 C146,58 138,66 128,66 C126,66 124.2,65.7 122.5,65.1 C128.5,62.8 132.8,57 132.8,50.2 C132.8,43.4 128.5,37.6 122.5,35.3 C124.2,34.7 126,30 128,30 Z"
                fill="url(#fdiMoonGrad)"
                opacity="0.9"
                className="fdi-anim-pulse"
              />
            )}

            {/* Back cloud layer */}
            <path
              d="M62,68 C62,60 68.5,53.5 76.5,53.5 C78,53.5 79.5,53.7 80.9,54.2 C83.4,46.7 90.4,41.5 98.8,41.5 C109.2,41.5 117.7,49.6 118.2,59.9 C122.3,61.4 125.2,65.3 125.2,70 C125.2,76.3 120,81.5 113.7,81.5 L75.5,81.5 C68,81.5 62,75.5 62,68 Z"
              fill={isNight ? "url(#fdiCloudDarkGrad)" : "url(#fdiCloudDarkGrad)"}
              opacity="0.7"
              className="fdi-anim-drift-left"
            />

            {/* Front main cloud */}
            <path
              d="M74,84 C74,75 81.3,67.7 90.3,67.7 C92,67.7 93.6,68 95.2,68.5 C98,60 106,54 115.5,54 C127.3,54 136.9,63.2 137.5,74.9 C142.2,76.5 145.5,81 145.5,86.2 C145.5,93.4 139.6,99.2 132.5,99.2 L89.2,99.2 C80.8,99.2 74,92.4 74,84 Z"
              fill="url(#fdiCloudFrontGrad)"
              filter="url(#fdiCloudShadow)"
              className="fdi-anim-drift-right"
            />
          </g>
        )}

        {/* ─── SCENE: RAIN ─── */}
        {kind === "rain" && (
          <g className="fdi-scene-rain">
            {/* Sun/Moon subtle background light */}
            {!isNight ? (
              <circle cx="130" cy="45" r="20" fill="url(#fdiSunGrad)" opacity="0.75" />
            ) : (
              <circle cx="130" cy="45" r="18" fill="url(#fdiMoonGrad)" opacity="0.65" />
            )}

            {/* Background cloud */}
            <path
              d="M55,62 C55,54.8 60.8,49 68,49 C69.4,49 70.7,49.2 72,49.7 C74.2,42.9 80.5,38 88,38 C97.4,38 105.1,45.3 105.5,54.6 C109.2,55.9 111.8,59.4 111.8,63.6 C111.8,69.3 107.1,74 101.4,74 L67,74 C60.4,74 55,68.6 55,62 Z"
              fill="url(#fdiStormCloudBackGrad)"
              opacity="0.6"
              className="fdi-anim-drift-left"
            />

            {/* Foreground rain cloud */}
            <path
              d="M68,76 C68,67.7 74.7,61 83,61 C84.6,61 86.1,61.3 87.5,61.7 C90.1,53.9 97.5,48.5 106.2,48.5 C117,48.5 125.8,57 126.4,67.7 C130.7,69.2 133.7,73.3 133.7,78.1 C133.7,84.7 128.3,90 121.8,90 L82,90 C74.3,90 68,83.7 68,76 Z"
              fill="url(#fdiStormCloudGrad)"
              filter="url(#fdiCloudShadow)"
              className="fdi-anim-drift-right"
            />

            {/* Animated raindrops */}
            <g className="fdi-rain-layer">
              <line x1="84" y1="96" x2="80" y2="114" stroke="url(#fdiRainGrad)" strokeWidth="2.5" strokeLinecap="round" className="fdi-anim-rain fdi-delay-1" />
              <line x1="96" y1="96" x2="92" y2="114" stroke="url(#fdiRainGrad)" strokeWidth="2.5" strokeLinecap="round" className="fdi-anim-rain fdi-delay-3" />
              <line x1="108" y1="96" x2="104" y2="114" stroke="url(#fdiRainGrad)" strokeWidth="2.5" strokeLinecap="round" className="fdi-anim-rain fdi-delay-2" />
              <line x1="120" y1="96" x2="116" y2="114" stroke="url(#fdiRainGrad)" strokeWidth="2.5" strokeLinecap="round" className="fdi-anim-rain fdi-delay-4" />
            </g>

            {/* Ground splashes / ripples */}
            <ellipse cx="79" cy="117" rx="3.5" ry="1" fill="#60A5FA" opacity="0.6" className="fdi-anim-splash fdi-delay-1" />
            <ellipse cx="91" cy="117" rx="3.5" ry="1" fill="#60A5FA" opacity="0.6" className="fdi-anim-splash fdi-delay-3" />
            <ellipse cx="103" cy="117" rx="3.5" ry="1" fill="#60A5FA" opacity="0.6" className="fdi-anim-splash fdi-delay-2" />
            <ellipse cx="115" cy="117" rx="3.5" ry="1" fill="#60A5FA" opacity="0.6" className="fdi-anim-splash fdi-delay-4" />
          </g>
        )}

        {/* ─── SCENE: THUNDERSTORM / STORM ─── */}
        {kind === "storm" && (
          <g className="fdi-scene-storm">
            {/* Ambient electric storm flash glow behind clouds */}
            <circle cx="110" cy="65" r="62" fill="#818CF8" opacity="0.18" className="fdi-anim-lightning-flash" />

            {/* Back dark storm cloud */}
            <path
              d="M52,60 C52,52 58.5,45.5 66.5,45.5 C68,45.5 69.5,45.8 71,46.3 C73.5,38.8 80.5,33.5 89,33.5 C99.5,33.5 108.1,41.6 108.6,52 C112.8,53.5 115.7,57.4 115.7,62.2 C115.7,68.5 110.5,73.6 104.2,73.6 L65.5,73.6 C58,73.6 52,67.5 52,60 Z"
              fill="url(#fdiStormCloudBackGrad)"
              opacity="0.8"
              className="fdi-anim-drift-left"
            />

            {/* Fore dark thunder cloud with volumetric depth */}
            <path
              d="M65,75 C65,65.6 72.6,58 82,58 C83.8,58 85.5,58.3 87.1,58.8 C90,50 98.4,43.8 108.3,43.8 C120.6,43.8 130.6,53.4 131.3,65.6 C136.2,67.3 139.6,71.9 139.6,77.4 C139.6,84.9 133.5,91 126,91 L81,91 C72.2,91 65,83.8 65,75 Z"
              fill="url(#fdiStormCloudGrad)"
              filter="url(#fdiCloudShadow)"
              className="fdi-anim-drift-right"
            />

            {/* Glowing Neon Lightning Bolt */}
            <path
              d="M107,64 L97,84 L107,84 L99,106 L116,81 L106,81 L112,64 Z"
              fill="url(#fdiLightningGrad)"
              filter="url(#fdiLightningGlow)"
              className="fdi-anim-lightning-bolt"
            />

            {/* Slanted angled raindrops */}
            <g className="fdi-rain-layer">
              <line x1="78" y1="94" x2="72" y2="114" stroke="url(#fdiStormRainGrad)" strokeWidth="2.5" strokeLinecap="round" className="fdi-anim-rain fdi-delay-1" />
              <line x1="90" y1="94" x2="84" y2="114" stroke="url(#fdiStormRainGrad)" strokeWidth="2.5" strokeLinecap="round" className="fdi-anim-rain fdi-delay-3" />
              <line x1="120" y1="94" x2="114" y2="114" stroke="url(#fdiStormRainGrad)" strokeWidth="2.5" strokeLinecap="round" className="fdi-anim-rain fdi-delay-2" />
              <line x1="132" y1="94" x2="126" y2="114" stroke="url(#fdiStormRainGrad)" strokeWidth="2.5" strokeLinecap="round" className="fdi-anim-rain fdi-delay-4" />
            </g>

            {/* Splash ripples */}
            <ellipse cx="71" cy="117" rx="3.5" ry="1" fill="#818CF8" opacity="0.7" className="fdi-anim-splash fdi-delay-1" />
            <ellipse cx="83" cy="117" rx="3.5" ry="1" fill="#818CF8" opacity="0.7" className="fdi-anim-splash fdi-delay-3" />
            <ellipse cx="113" cy="117" rx="3.5" ry="1" fill="#818CF8" opacity="0.7" className="fdi-anim-splash fdi-delay-2" />
            <ellipse cx="125" cy="117" rx="3.5" ry="1" fill="#818CF8" opacity="0.7" className="fdi-anim-splash fdi-delay-4" />
          </g>
        )}
      </svg>
    </div>
  );
}
