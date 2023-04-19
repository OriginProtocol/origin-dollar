import { useEffect } from 'react';

const useInterval = (interval: number, cb: (...args: any[]) => void) => {
  useEffect(() => {
    const intervalId = setInterval(cb, interval);

    return () => clearInterval(intervalId);
  }, []);
};

export default useInterval;
