import { useCallback, useEffect, useState } from "react";

export const MOBILE_UI_VERSION_KEY = "pgp2.mobile-ui-version";
export const V2_MAX_VIEWPORT_WIDTH = 1366;

export function supportsV2Viewport(width = globalThis.innerWidth) {
  return Number.isFinite(width) && width <= V2_MAX_VIEWPORT_WIDTH;
}

export function readMobileUiVersion(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(MOBILE_UI_VERSION_KEY) === "v2" ? "v2" : "v1";
  } catch {
    return "v1";
  }
}

export function useMobileUiVersion() {
  const [mobileUiVersion, setVersionState] = useState(readMobileUiVersion);
  const [supportsV2, setSupportsV2] = useState(() => supportsV2Viewport());

  useEffect(() => {
    const query = globalThis.matchMedia?.(`(max-width: ${V2_MAX_VIEWPORT_WIDTH}px)`);
    if (!query) return undefined;
    const update = () => setSupportsV2(query.matches);
    update();
    try { query.addEventListener("change", update); } catch { query.addListener?.(update); }
    return () => {
      try { query.removeEventListener("change", update); } catch { query.removeListener?.(update); }
    };
  }, []);

  const setMobileUiVersion = useCallback((version) => {
    const next = version === "v2" ? "v2" : "v1";
    setVersionState(next);
    try { localStorage.setItem(MOBILE_UI_VERSION_KEY, next); } catch { /* storage unavailable */ }
  }, []);

  return {
    mobileUiVersion,
    setMobileUiVersion,
    supportsV2,
    v2Active: mobileUiVersion === "v2" && supportsV2,
  };
}

