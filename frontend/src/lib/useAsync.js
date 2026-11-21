import { useEffect, useState } from 'react';
import { showError } from './toast';

/**
 * Runs `fn` on mount / when `deps` change. Returns { data, loading, error, reload, setData, mutate }.
 * `loading` is only true while there is nothing to show yet: a reload refreshes in place,
 * so small actions never swap the page for the full-page loader.
 */
export function useAsync(fn, deps = []) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState(() => ({ data: null, loading: true, error: null, key }));
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    // new deps = a different record (another task, another brand): start from the loader.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a no-op on plain reloads
    setState((s) => (s.key === key ? s : { data: null, loading: true, error: null, key }));
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null, key }))
      .catch((e) => alive && setState((s) => ({ ...s, loading: false, error: e.message })));
    return () => { alive = false; };
    // `fn` is re-created every render; `deps` is the caller's real dependency list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, key]);

  const reload = () => setNonce((n) => n + 1);
  const setData = (change) => setState((s) => ({ ...s, data: typeof change === 'function' ? change(s.data) : change }));

  /**
   * Optimistic update: apply `change` to the data now, send `request` in the background.
   * On failure the page reloads from the server (the revert) and a toast says why.
   * Resolves to the request's result, or undefined when it failed.
   */
  const mutate = async (change, request) => {
    setData(change);
    try {
      return await request();
    } catch (e) {
      showError(e.message);
      reload();
      return undefined;
    }
  };

  return { ...state, reload, setData, mutate };
}
