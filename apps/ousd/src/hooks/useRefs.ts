import { useMemo, createRef, RefObject } from "react";

const useRefs = <T extends HTMLElement>(length: number) =>
  useMemo<RefObject<T>[]>(
    () => Array.from({ length }, () => createRef<T>()),
    [length]
  );

export default useRefs;
