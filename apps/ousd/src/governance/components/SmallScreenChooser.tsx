import StepButton from "./StepButton";
import Image from "next/image";
import React, { Dispatch, SetStateAction } from "react";
import { ActiveSmall } from "../types";
import { assetRootPath } from "../../utils/image";
import { Step1, Step2, Step3, Step4, Step5 } from ".";

interface SmallScreenChooserProps {
  active: ActiveSmall;
  setActive: Dispatch<SetStateAction<ActiveSmall>>;
  stakingApy: number;
  titles: string[];
}

const steps = [Step1, Step2, Step3, Step4, Step5];

const SmallScreenChooser = ({
  active,
  setActive,
  stakingApy,
  titles,
}: SmallScreenChooserProps) => {
  return (
    <div className="z-10 w-full">
      {titles.map((title, index) => (
        <div key={index}>
          <StepButton
            {...{ active, setActive, title, number: `0${index + 1}` }}
            className="w-full opacity-100 relative"
          >
            {
              {
                1: <>{active[index + 1] ? <ArrowUp /> : <ArrowDown />}</>,
                2: <>{active[index + 1] ? <ArrowUp /> : <ArrowDown />}</>,
                3: <>{active[index + 1] ? <ArrowUp /> : <ArrowDown />}</>,
                4: <>{active[index + 1] ? <ArrowUp /> : <ArrowDown />}</>,
                5: <>{active[index + 1] ? <ArrowUp /> : <ArrowDown />}</>,
              }[index + 1]
            }
          </StepButton>
          {
            {
              1: <>{active[index + 1] && <Step1 className="my-5 ml-1" />}</>,
              2: (
                <>
                  {active[index + 1] && (
                    <Step2 {...{ stakingApy }} className="my-5 ml-1" />
                  )}
                </>
              ),
              3: <>{active[index + 1] && <Step3 className="my-5 ml-1" />}</>,
              4: <>{active[index + 1] && <Step4 className="my-5 ml-1" />}</>,
              5: <>{active[index + 1] && <Step5 className="my-5 ml-1" />}</>,
            }[index + 1]
          }
        </div>
      ))}
    </div>
  );
};

const ArrowDown = () => {
  return (
    <Image
      src={assetRootPath("/images/arrow-down.svg")}
      width={16}
      height={16}
      alt="arrow-down"
      className="absolute top-1/2 -translate-y-1/2 right-4"
    />
  );
};

const ArrowUp = () => {
  return (
    <Image
      src={assetRootPath("/images/arrow-up.svg")}
      width={16}
      height={16}
      alt="arrow-up"
      className="absolute top-1/2 -translate-y-1/2 right-4"
    />
  );
};

export default SmallScreenChooser;
