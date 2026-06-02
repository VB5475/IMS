import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const DEFAULT_HEADER = {
  title: null,
  subtitle: null,
  showBack: false,
  backTo: '/',
};

const PageHeaderContext = createContext(null);

export function PageHeaderProvider({ children }) {
  const [header, setHeaderState] = useState(DEFAULT_HEADER);

  const setHeader = useCallback((partial) => {
    setHeaderState({ ...DEFAULT_HEADER, ...partial });
  }, []);

  const resetHeader = useCallback(() => {
    setHeaderState(DEFAULT_HEADER);
  }, []);

  const value = useMemo(
    () => ({ header, setHeader, resetHeader, hasLayoutHeader: true }),
    [header, setHeader, resetHeader],
  );

  return (
    <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>
  );
}

/** Returns true when running inside Nexus/Horizon app shell */
export function useLayoutHeaderActive() {
  return Boolean(useContext(PageHeaderContext)?.hasLayoutHeader);
}

export function usePageHeaderContext() {
  return useContext(PageHeaderContext);
}

/**
 * Register page title/subtitle/back in the app layout top bar.
 * No-op when used outside PageHeaderProvider (original standalone app).
 */
export function usePageHeader({ title, subtitle, showBack = false, backTo = '/' } = {}) {
  const ctx = useContext(PageHeaderContext);
  const setHeader = ctx?.setHeader;
  const resetHeader = ctx?.resetHeader;

  useEffect(() => {
    if (!setHeader) return undefined;
    setHeader({ title, subtitle, showBack, backTo });
    return () => resetHeader?.();
  }, [setHeader, resetHeader, title, subtitle, showBack, backTo]);
}

export function getDefaultRouteTitle(pathname) {
  if (pathname.startsWith('/main/')) return 'Report Workspace';
  if (pathname.startsWith('/txn-entry')) return 'Sample Invoice';
  return 'Dashboard';
}
