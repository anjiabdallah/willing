import { useState, useCallback, useEffect, useRef } from 'react';

import useNotifications from '../notifications/useNotifications';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseAsyncOptions {
  immediate?: boolean;
  notifyOnError?: boolean;
}

export default function useAsync<T = unknown, Args extends unknown[] = unknown[]>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: UseAsyncOptions = {},
) {
  const { immediate = false, notifyOnError = true } = options;

  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const notifications = useNotifications();
  const hasRunImmediate = useRef(false);

  const trigger = useCallback(
    async (...args: Args): Promise<T> => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const response = await asyncFunction(...args);
        setState({ data: response, loading: false, error: null });
        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ data: null, loading: false, error });

        if (notifyOnError) {
          notifications.push({
            type: 'error',
            message: error.message,
          });
        }

        throw error;
      }
    },
    [asyncFunction, notifyOnError, notifications],
  );

  useEffect(() => {
    if (immediate && !hasRunImmediate.current) {
      (trigger as () => Promise<T>)();
      hasRunImmediate.current = true;
    }
  }, [trigger, immediate]);

  return { ...state, trigger };
}
