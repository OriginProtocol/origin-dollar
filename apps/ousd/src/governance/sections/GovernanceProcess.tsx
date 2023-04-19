import React from "react";
import { Typography } from "@originprotocol/origin-storybook";
import { twMerge } from "tailwind-merge";
import { Section } from "../../components";
import { GovernanceProcessItem } from "../components";
import { useViewWidth } from "../../hooks";
import { lgSize } from "../../constants";

interface GovernanceProcessProps {
  sectionOverrideCss?: string;
}

const GovernanceProcess = ({ sectionOverrideCss }: GovernanceProcessProps) => {
  const width = useViewWidth();

  return (
    <Section className={twMerge("pt-20", sectionOverrideCss)}>
      <Typography.H6>The governance process</Typography.H6>
      <GovernanceProcessItem
        imgRoute={"/images/discord.svg"}
        imgSize={width > lgSize ? 32 : 20}
        title="Discussion Forum"
        description="The Origin Dollar community lives in Discord, where the protocol was developed in public. Many improvement proposals are born here through transparent discussion and debate. While there is no requirement to discuss improvements prior to submitting a proposal, this is where the conversation happens."
        externalDescription="Discord governance forum"
        externalLink="https://discord.com/channels/404673842007506945/1025438212908396564/"
        className="pt-8 lg:pt-16"
      />
      <GovernanceProcessItem
        imgRoute="/images/lightning.svg"
        imgSize={width > lgSize ? 40 : 24}
        title="Snapshot vote"
        description="All off-chain voting occurs on the OUSD Governance Snapshot space. This allows for signaling votes and temperature checks to be conducted without participants needing to spend gas. Other proposals belong on Snapshot because they don't require on-chain execution to be implemented, such as the weekly funds reallocation or the initiation of new strategy development."
        externalDescription="Snapshot space"
        participationRequirments={{
          snapshotMinimum: "10,000 veOGV",
          voteMinimum: "No minimum",
          quorumMinimum: "50 million veOGV",
        }}
        externalLink="https://vote.ousd.com/"
      />
      <GovernanceProcessItem
        imgRoute="/images/ethereum.svg"
        imgSize={width > lgSize ? 20 : 12}
        title="On-chain implementation"
        description="All configuration changes and improvements to the protocol's smart contracts must be executed on-chain. Origin Dollar's governance contracts are derived from OpenZeppelin's open-source code and require technical expertise to update. All on-chain proposals are reviewed for security risks and any changes to the code should be accompanied by a thorough security audit. A 48-hour timelock provides an added layer of security preventing changes from taking effect immediately after an on-chain vote is passed."
        externalDescription="OUSD governance portal"
        externalLink="https://governance.ousd.com/"
        participationRequirments={{
          snapshotMinimum: "10,000,000 veOGV",
          voteMinimum: "No minimum",
          quorumMinimum: "20% of veOGV supply",
        }}
        hasLine={false}
      />
    </Section>
  );
};

export default GovernanceProcess;
