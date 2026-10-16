import { useEffect, useState } from 'react';

/** Return a debounced copy of `value` that updates after `delay` ms of quiet. */
export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default useDebounce;
