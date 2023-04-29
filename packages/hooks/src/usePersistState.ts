import { useLocalStorage } from 'react-use';
import { useEffect, useMemo } from 'react';
import { pick } from 'lodash';

type UsePersistStateProps = {
  storageKey: string;
  saveFields: string[];
  onMount: (a: any) => void;
};

const usePersistState = (
  watchValue: any,
  { storageKey, saveFields, onMount }: UsePersistStateProps
) => {
  const [stored, setStored] = useLocalStorage(storageKey, null);

  const peristableFields = useMemo(
    () => pick(watchValue, saveFields),
    [JSON.stringify(watchValue)]
  );

  // Persist side effects
  useEffect(() => {
    // @ts-ignore
    setStored(peristableFields);
  }, [peristableFields]);

  // Merge any persisted state (client only to avoid ssr state mismatch)
  useEffect(() => {
    if (onMount) {
      onMount(stored);
    }
  }, []);

  return [{ data: stored }, { onSet: setStored }];
};

export default usePersistState;
