import { useMemo } from "react";
import { useLocation } from "react-router-dom";

const HIDDEN_PATH_PATTERNS = [/^\/reader\//];

function usePageChromeVisibility(): boolean {
    const location = useLocation();

    return useMemo(
        () => !HIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(location.pathname)),
        [location.pathname],
    );
}

export function useFooterVisibility(): boolean {
    return usePageChromeVisibility();
}

export function useHeaderVisibility(): boolean {
    return usePageChromeVisibility();
}
