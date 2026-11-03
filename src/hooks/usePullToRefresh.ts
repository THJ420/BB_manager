import { useCallback, useRef, useState } from 'react';

export interface PullToRefreshState {
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * Guards against overlapping RefreshControl callbacks. React Native's Android
 * RefreshControl can otherwise stay stuck when onRefresh fires twice before the
 * first promise settles.
 */
export function usePullToRefresh(refresh: () => Promise<void>): PullToRefreshState {
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const onRefresh = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    void refresh()
      .catch((error) => console.warn('Pull-to-refresh failed', error))
      .finally(() => {
        inFlight.current = false;
        setRefreshing(false);
      });
  }, [refresh]);

  return { refreshing, onRefresh };
}
