import { Typography } from "@originprotocol/origin-storybook";
import Image from "next/image";
import React from "react";
import { Gradient2Button } from "../../components";
import { assetRootPath } from "../../utils/image";

interface Step3Props {
  className?: string;
}

const Step3 = ({ className }: Step3Props) => {
  return (
    <div className={className}>
      <Typography.Body2 className="text-blurry">
        In the <strong>ousd-governance-forum</strong> within the Origin Discord
        server, you can create a new post summarizing your proposal or join an
        existing discussion.
      </Typography.Body2>

      <Typography.Body2 className="text-white-grey mt-4">
        There should be a forum post representing each proposal that exists on
        Snapshot or the OUSD governance portal. It&apos;s best to go ahead and
        create a proposal and forum post at the same time rather than wait for
        approval. There&apos;s no harm in getting a signal and starting the
        conversation.
      </Typography.Body2>

      <Gradient2Button
        className="bg-transparent hover:bg-transparent py-3"
        outerDivClassName="mt-10"
        onClick={() =>
          process.browser &&
          window.open(
            "https://discord.com/channels/404673842007506945/1025438212908396564/",
            "_blank",
            "noopener noreferrer"
          )
        }
      >
        <Typography.Body2 className="inline">
          Origin Protocol Discord server
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

export default Step3;
