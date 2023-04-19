import { useEffect, RefObject } from "react";

const useIntersectionObserver = (
  elements: RefObject<HTMLElement>[],
  cb: IntersectionObserverCallback,
  options?: IntersectionObserverInit
) => {
  useEffect(() => {
    const observer = new IntersectionObserver(cb, options);

    elements.forEach((e) => observer.observe(e.current));

    return () => observer.disconnect();
  }, elements);
};

export default useIntersectionObserver;
