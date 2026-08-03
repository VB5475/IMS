import { useCallback, useRef } from "react";

/**
 * EntryGrid never awaits onCellEvent. Track each fire so Save can blur the
 * active cell and await the in-flight recalculation before validate/getRows/POST.
 *
 * Usage:
 *   const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();
 *   const handleCellEvent = useCallback((evt) => trackCellEvent(async () => { ... }), [...]);
 *   // at start of handleSave:
 *   await flushPendingCellEvents(itemGridSectionRef);
 */
export function usePendingCellEventFlush() {
  const pendingCellEventRef = useRef(null);

  const trackCellEvent = useCallback((asyncWork) => {
    const promise = (async () => asyncWork())();
    pendingCellEventRef.current = promise;
    promise.finally(() => {
      if (pendingCellEventRef.current === promise) pendingCellEventRef.current = null;
    });
    return promise;
  }, []);

  const flushPendingCellEvents = useCallback(async (gridSectionRef) => {
    const active = document.activeElement;
    const root = gridSectionRef?.current ?? null;
    if (active && root?.contains?.(active) && typeof active.blur === "function") {
      active.blur();
    }
    if (pendingCellEventRef.current) {
      await pendingCellEventRef.current;
    }
  }, []);

  return { pendingCellEventRef, trackCellEvent, flushPendingCellEvents };
}
