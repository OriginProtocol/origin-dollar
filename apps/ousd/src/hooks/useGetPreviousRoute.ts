import { useEffect, useRef } from "react";
import { RouteStore } from "../stores";

const useGetPreviousRoute = () => {
  const prev = RouteStore.useState((s) => s.prevRoute);
  const prevRef = useRef<string | null>(prev);

  // We want to retrieve the value in the store before it is updated and a
  // rerender occurs
  useEffect(() => {
    if (prevRef.current === prev) return;
    prevRef.current = prev;
  }, []);

  return prevRef.current;
};

export default useGetPreviousRoute;
