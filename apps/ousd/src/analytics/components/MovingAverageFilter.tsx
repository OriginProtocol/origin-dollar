import { typeOptions } from "../utils";

const MovingAverageFilter = ({ value, onChange }) => {
  return (
    <select
      className="flex flex-row items-center w-auto h-[36px] bg-origin-bg-black rounded-lg px-3 text-sm focus:outline-none"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    >
      {typeOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default MovingAverageFilter;
