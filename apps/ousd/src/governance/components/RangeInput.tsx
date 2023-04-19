import { Typography } from "@originprotocol/origin-storybook";
import { FunctionComponent, ChangeEventHandler } from "react";

interface Marker {
  label: string;
  value: number;
}

interface RangeInputProps {
  label: string;
  min: number;
  max: number;
  value: number | string;
  markers?: Marker[];
  onChange: ChangeEventHandler<HTMLInputElement>;
  onMarkerClick?: (marker: string) => void;
  hideLabel?: Boolean;
  hideLabelFormatting?: Boolean;
}

const RangeInput: FunctionComponent<RangeInputProps> = ({
  label,
  min,
  max,
  value,
  markers,
  onChange,
  onMarkerClick,
}) => (
  <div className="border border-range-border mt-8 p-4 rounded-lg">
    <Typography.Body3 className="text-sm mb-4">{label}</Typography.Body3>
    {/* Label */}
    <div className="mb-4 bg-origin-bg-grey w-fit px-6 py-3 rounded-lg">
      <Typography.Body>
        {value} Month{value > 1 ? "s" : ""}
      </Typography.Body>
    </div>
    <div>
      <input
        className="w-full border"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={onChange}
      />
      {markers && markers.length > 0 && (
        <>
          <div className="w-full flex justify-between text-xs text-gray-400">
            {markers.map((marker, index) => (
              <span key={index} className="flex flex-col items-center w-8">
                <button
                  onClick={
                    onMarkerClick
                      ? () => onMarkerClick(marker.value.toString())
                      : null
                  }
                  className={`mt-1 hover:underline whitespace-nowrap ${
                    index === markers.length - 1 ? "md:-translate-x-3" : ""
                  }`}
                >
                  {marker.label}
                </button>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  </div>
);

export default RangeInput;
