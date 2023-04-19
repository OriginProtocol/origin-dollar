import cx from "classnames";
import { durationOptions } from "../utils";

const DurationFilter = ({ value, onChange }) => (
  <div className="flex flex-row items-center w-full h-[36px] bg-origin-bg-black p-1 rounded-lg space-x-2">
    {durationOptions.map((duration) => {
      const isActiveDuration = value === duration.value;
      return (
        <button
          key={duration.value}
          className={cx(
            "flex items-center justify-center rounded-[4px] w-[26px] md:w-[36px] h-[28px] text-xs md:text-sm",
            {
              "bg-gradient shadow-xs shadow-filter": isActiveDuration,
            }
          )}
          onClick={onChange.bind(null, duration.value)}
        >
          <span
            className={cx({
              "text-subheading font-light": !isActiveDuration,
              "text-origin-white": isActiveDuration,
            })}
          >
            {duration.label}
          </span>
        </button>
      );
    })}
  </div>
);

export default DurationFilter;
