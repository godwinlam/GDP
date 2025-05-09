import { useEffect } from 'react';

export function useMount(callback: () => void | Promise<void>) {
  useEffect(() => {
    callback();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
