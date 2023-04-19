import { useEffect, MutableRefObject } from "react";

const useOutOfBoundsClick = (
  ref: MutableRefObject<any>,
  cb: (e: any) => any
) => {
  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [ref, cb]);

  const handleClickOutside = (e: any) => {
    if (!ref.current || ref.current.contains(e.target)) return;
    cb(e);
  };
};

export default useOutOfBoundsClick;
