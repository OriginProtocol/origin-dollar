import { useState, useEffect } from "react";

const hasWindow = typeof window !== "undefined";

export const useViewWidth = () => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!hasWindow) return;
    setWidth(hasWindow ? window.innerWidth : 0);

    const handleResize = () => setWidth(hasWindow ? window.innerWidth : 0);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
};

export default useViewWidth;
