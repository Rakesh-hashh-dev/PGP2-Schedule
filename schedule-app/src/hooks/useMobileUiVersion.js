import { useCallback, useState } from "react";

export const MOBILE_UI_VERSION_KEY = "pgp2.mobile-ui-version";

export function readMobileUiVersion(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(MOBILE_UI_VERSION_KEY) === "v2" ? "v2" : "v1";
  } catch {
    return "v1";
  }
}

export function useMobileUiVersion() {
  const [mobileUiVersion, setVersionState] = useState(readMobileUiVersion);

  const setMobileUiVersion = useCallback((version) => {
    const next = version === "v2" ? "v2" : "v1";
    setVersionState(next);
    try { localStorage.setItem(MOBILE_UI_VERSION_KEY, next); } catch { /* storage unavailable */ }
  }, []);

  return { mobileUiVersion, setMobileUiVersion };
}
