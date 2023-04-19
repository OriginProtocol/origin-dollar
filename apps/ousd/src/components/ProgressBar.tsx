import { useEffect, useState } from "react";
import cx from "classnames";

const ProgressBar = ({
  numerator,
  color,
  denominator = 100,
  loadDelay = 300,
  className = "",
}) => {
  const [value, setValue] = useState({ numerator: 0, denominator });
  useEffect(() => {
    setTimeout(() => {
      setValue({
        numerator,
        denominator,
      });
    }, loadDelay);
  }, []);
  return (
    <div className="w-full h-[8px] rounded-full bg-origin-bg-dgrey">
      <div
        className={cx(
          "w-full h-full transition-all duration-1000 ease-in rounded-full",
          className
        )}
        style={{
          width: `${(value?.numerator / value?.denominator) * 100}%`,
          background: color,
        }}
      />
    </div>
  );
};

export default ProgressBar;
