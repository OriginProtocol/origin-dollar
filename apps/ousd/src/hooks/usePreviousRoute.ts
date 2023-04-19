import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import { RouteStore } from "../stores";

// this would have to go in `_app.tsx` to be a true previous route tracker (across all pages)
const usePreviousRoute = () => {
  const { asPath } = useRouter();

  useEffect(() => {
    RouteStore.update((s) => {
      s.prevRoute = asPath;
    });
  }, [asPath]);
};

export default usePreviousRoute;
