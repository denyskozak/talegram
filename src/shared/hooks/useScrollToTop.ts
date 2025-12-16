import { useEffect } from "react";
import type { DependencyList } from "react";

interface UseScrollToTopOptions {
  /** Scroll behavior for the scrollTo call. Defaults to smooth for better UX. */
  behavior?: ScrollBehavior;
  /** Optional scrollable element. When omitted the window will be used. */
  element?: HTMLElement | null;
}

export function useScrollToTop(
  dependencies: DependencyList = [],
  { behavior = "smooth", element }: UseScrollToTopOptions = {},
): void {
  useEffect(() => {
    setTimeout(() => {
        if (typeof window === "undefined") {
            return;
        }

        if (element) {
            element.scrollTo({ top: 0, behavior });
            return;
        }

        window.scrollTo({ top: 0, behavior });
    })
  }, [...dependencies, element, behavior]);
}
