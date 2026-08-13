import { useCallback, useRef } from "react";

/**
 * EntryGrid never awaits onCellEvent. Track each fire so Save can blur the
 * active cell and await the in-flight recalculation before validate/getRows/POST.
 *
 * Tracks a SET of in-flight promises, not just the latest one — a multi-row
 * picker insert fires one cell-event per row concurrently (Promise.all), and
 * a single-slot ref would only ever await the last one to start, letting
 * Save race ahead of every earlier row's still-pending recalculation and
 * post its stale (often zero) amount.
 *
 * `key` (optional, typically a rowId) guards against a SEPARATE race: editing
 * two event columns on the SAME row in quick succession (e.g. Qty then Rate)
 * fires two independent cell-event requests for that row; network timing does
 * not guarantee responses arrive in the order the requests were sent. Without
 * this guard, an older request's late-arriving response — computed from the
 * row's state BEFORE the newer edit — can land after and silently overwrite
 * the newer, already-applied, correct values. When `key` is supplied,
 * `asyncWork` receives an `isLatest()` check the caller must consult before
 * applying its response; only the most-recently-STARTED call for that key
 * ever passes it. Omitting `key` preserves old behavior (no guard).
 *
 * Usage:
 *   const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();
 *   const handleCellEvent = useCallback(({ rowId, ... }) =>
 *     trackCellEvent(async (isLatest) => {
 *       const result = await fireCellEvent(...);
 *       if (!isLatest()) return; // a newer request for this row already won
 *       itemGridRef.current.updateRow(rowId, ...);
 *     }, rowId), [...]);
 *   // at start of handleSave:
 *   await flushPendingCellEvents(itemGridSectionRef);
 */
export function usePendingCellEventFlush() {
  const pendingCellEventsRef = useRef(new Set());
  const latestSeqByKeyRef = useRef(new Map());

  const trackCellEvent = useCallback((asyncWork, key) => {
    let isLatest = () => true;
    if (key != null) {
      const mySeq = (latestSeqByKeyRef.current.get(key) ?? 0) + 1;
      latestSeqByKeyRef.current.set(key, mySeq);
      isLatest = () => latestSeqByKeyRef.current.get(key) === mySeq;
    }
    const promise = (async () => asyncWork(isLatest))();
    pendingCellEventsRef.current.add(promise);
    promise.finally(() => {
      pendingCellEventsRef.current.delete(promise);
    });
    return promise;
  }, []);

  const flushPendingCellEvents = useCallback(async (gridSectionRef) => {
    const active = document.activeElement;
    const root = gridSectionRef?.current ?? null;
    if (active && root?.contains?.(active) && typeof active.blur === "function") {
      active.blur();
    }
    // Snapshot + loop: awaiting one pending promise can itself queue new
    // cell-events (e.g. a cascading recalculation) before this returns.
    while (pendingCellEventsRef.current.size > 0) {
      await Promise.all([...pendingCellEventsRef.current]);
    }
  }, []);

  return { pendingCellEventsRef, trackCellEvent, flushPendingCellEvents };
}
