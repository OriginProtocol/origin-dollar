import React from "react";
import Image from "next/image";
import { Typography } from "@originprotocol/origin-storybook";
import { Gradient2Button } from "../../components";
import { assetRootPath } from "../../utils/image";

interface Step5Props {
  className?: string;
}

const Step5 = ({ className }: Step5Props) => {
  return (
    <div className={className}>
      <Typography.Body2 className="text-blurry">
        Influence the future of the protocol by casting your vote.
      </Typography.Body2>

      <Typography.Body2 className="text-white-grey mt-4">
        Voting power is determined by the number of veOGV (staked OGV) in your
        Web3 wallet. It&apos;s free to vote on Snapshot proposals and there is
        no minimum amount required.
        <br />
        <br />
        On-chain votes require Ethereum gas to be recorded on the blockchain.
        Once an on-chain proposal is approved, 48 hours must pass before the
        proposal can be executed. This would give everyone a chance to take
        action if a malicious proposal were to get through.
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
          View snapshot proposals{" "}
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
        outerDivClassName="mt-10 inline py-4 px-5"
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
          View on-chain proposals{" "}
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

export default Step5;
