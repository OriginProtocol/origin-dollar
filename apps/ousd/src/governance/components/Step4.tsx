import React from "react";
import Image from "next/image";
import { Typography } from "@originprotocol/origin-storybook";
import { Gradient2Button } from "../../components";
import { assetRootPath } from "../../utils/image";

interface Step4Props {
  className?: string;
}

const Step4 = ({ className }: Step4Props) => {
  return (
    <div className={className}>
      <Typography.Body2 className="text-blurry">
        Create a non-binding proposal on Snapshot or a binding, on-chain
        proposal when you&apos;re ready for an up/down vote.
      </Typography.Body2>

      <Typography.Body2 className="text-white-grey mt-4">
        You will need to connect the Web3 wallet containing your veOGV (staked
        OGV) to verify eligibility and determine your voting power.
        <br />
        <br />
        Off-chain proposals are great for temperature checks and signaling votes
        since they are gasless. Snapshot also supports several different voting
        systems with innovative ways to calculate the outcome of a proposal.
        <br />
        <br />
        On-chain proposals are submitted directly to the governance contracts in
        the form of executable code. This requires some technical knowledge and
        is usually preceded by a Snapshot vote and forum discussion.
      </Typography.Body2>

      <Gradient2Button
        className="bg-transparent hover:bg-transparent mt-10"
        outerDivClassName="mt-10 inline py-4 px-5 mr-4"
        onClick={() =>
          process.browser &&
          window.open("https://vote.ousd.com/", "_blank", "noopener noreferrer")
        }
      >
        <Typography.Body2 className="inline">
          OUSD Snapshot space{" "}
        </Typography.Body2>
        <Image
          src={assetRootPath("/images/external-link-white.svg")}
          width={12}
          height={12}
          alt="External Link"
          className="ml-2 inline"
        />
      </Gradient2Button>
      <Gradient2Button
        className="bg-transparent hover:bg-transparent mt-4"
        outerDivClassName="inline py-4 px-5"
        onClick={() =>
          process.browser &&
          window.open(
            "https://governance.ousd.com/",
            "_blank",
            "noopener noreferrer"
          )
        }
      >
        <Typography.Body2 className="inline">
          OUSD governance portal
        </Typography.Body2>
        <Image
          src={assetRootPath("/images/external-link-white.svg")}
          width={12}
          height={12}
          alt="External Link"
          className="ml-2 inline"
        />
      </Gradient2Button>
    </div>
  );
};

export default Step4;
