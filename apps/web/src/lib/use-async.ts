"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Eski isteğin sonucu yeni oturumun verisini değiştiremez. */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
): {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
} {
  const latest = useRef(fn);
  latest.current = fn;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    data: T | undefined;
    error: unknown;
    loading: boolean;
  }>({ data: undefined, error: null, loading: true });
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setState({ data: undefined, error: null, loading: true });
    void latest.current().then(
      (data) => {
        if (active) setState({ data, error: null, loading: false });
      },
      (error: unknown) => {
        if (active) setState({ data: undefined, error, loading: false });
      },
    );
    return () => {
      active = false;
    };
    // Çağıran, isteğin veri bağımlılıklarını açıkça verir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision]);
  return { ...state, reload };
}
