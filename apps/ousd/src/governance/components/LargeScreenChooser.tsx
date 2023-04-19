import React, { Dispatch, SetStateAction } from "react";
import StepButton from "./StepButton";

interface LargeScreenChooserProps {
  active: number;
  setActive: Dispatch<SetStateAction<number>>;
  titles: string[];
}

const LargeScreenChooser = ({
  active,
  setActive,
  titles,
}: LargeScreenChooserProps) => {
  return (
    <div className="z-10">
      {titles.map((title, index) => (
        <StepButton
          key={index}
          active={active}
          setActive={setActive}
          number={`0${index + 1}`}
          title={title}
          className={`${index === 0 ? "mt-0" : ""}`}
        />
      ))}
    </div>
  );
};

export default LargeScreenChooser;
