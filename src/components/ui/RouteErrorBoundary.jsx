// RouteErrorBoundary.jsx — replaces React Router's default dev-facing error
// screen (the "💿 Hey developer" page) with an on-brand one, and specifically
// handles the most common production failure: a lazy-loaded route chunk
// 404ing because the app was redeployed while this tab still had the old
// index.html open (its chunk hashes no longer exist on the server).
//
// For that specific case: auto-reload once (a real hard reload — the
// in-memory module registry for the failed chunk can stay broken even after
// a retry within the same page load, so only a fresh navigation reliably
// fixes it), guarded by sessionStorage so a genuinely broken deploy can't
// reload-loop forever. Any other route error (or a chunk error that
// recurred even after the auto-reload) falls through to a manual "Try
// Again" button instead.

import React, { useEffect, useState } from "react";
import { useRouteError } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import "./RouteErrorBoundary.css";

// Covers Chrome/Edge, Firefox, and Safari's differently-worded versions of
// the same "this dynamic import 404'd" failure.
const CHUNK_LOAD_ERROR_PATTERN =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i;

const RELOAD_GUARD_KEY = "ims_chunk_reload_attempted";

function isChunkLoadError(error) {
  const message = String(error?.message ?? error ?? "");
  return CHUNK_LOAD_ERROR_PATTERN.test(message);
}

function readGuard() {
  try {
    return sessionStorage.getItem(RELOAD_GUARD_KEY) === "1";
  } catch {
    // sessionStorage unavailable (e.g. locked-down privacy mode) — treat as
    // already-tried so we skip straight to the manual fallback UI below
    // rather than risk a reload loop we can't guard.
    return true;
  }
}

function setGuard() {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

function clearGuard() {
  try {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  } catch {
    // ignore — worst case Try Again just behaves like the auto-reload path
  }
}

export default function RouteErrorBoundary() {
  const error = useRouteError();
  const [autoReloading, setAutoReloading] = useState(false);
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (!chunkError) return undefined;
    if (readGuard()) return undefined;
    if (!setGuard()) return undefined;

    setAutoReloading(true);
    // Brief delay so the "Updating…" state actually gets a chance to paint
    // before navigation tears the page down — purely cosmetic, the reload
    // itself is what fixes the error.
    const t = setTimeout(() => window.location.reload(), 400);
    return () => clearTimeout(t);
  }, [chunkError]);

  const handleTryAgain = () => {
    clearGuard();
    window.location.reload();
  };

  if (autoReloading) {
    return (
      <div className="route-error">
        <div className="route-error__card">
          <RefreshCw size={26} strokeWidth={2} className="route-error__icon route-error__icon--spin" />
          <h1 className="route-error__title">Updating…</h1>
          <p className="route-error__message">
            A newer version of this app is available. Reloading now.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="route-error">
      <div className="route-error__card">
        <AlertTriangle size={26} strokeWidth={2} className="route-error__icon" />
        <h1 className="route-error__title">
          {chunkError ? "This page couldn't load" : "Something went wrong"}
        </h1>
        <p className="route-error__message">
          {chunkError
            ? "This usually happens right after the app has been updated. Reloading should fix it."
            : "An unexpected error occurred while loading this page."}
        </p>
        <button type="button" className="route-error__btn" onClick={handleTryAgain}>
          <RefreshCw size={14} strokeWidth={2.5} />
          Try Again
        </button>
      </div>
    </div>
  );
}
