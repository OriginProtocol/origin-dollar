import { types } from "hardhat/config";
import { action } from "../lib/action";
import { manageBribes } from "../poolBooster";

action({
  name: "manageCurvePoolBoosterBribes",
  description:
    "Calls manageBribes on the CurvePoolBoosterBribesModule and calculates the rewards per vote based on the target efficiency",
  chains: [1],
  params: (t) => {
    t.addOptionalParam(
      "efficiency",
      "Target efficiency (0-10, e.g. 1 for 100%, 0.5 for 50%)",
      "1",
      types.string
    );
    t.addOptionalParam(
      "skipRewardPerVote",
      "Skip setting RewardPerVote (pass array of zeros)",
      false,
      types.boolean
    );
    t.addOptionalParam(
      "chunkSize",
      "Number of pool boosters to manage per transaction",
      4,
      types.int
    );
  },
  run: async ({ signer, log, args }) => {
    log.info(
      `Managing max reward per vote with target efficiency ${args.efficiency}, skip reward per vote ${args.skipRewardPerVote}, chunk size ${args.chunkSize}`
    );
    await manageBribes({
      signer,
      provider: signer.provider!,
      targetEfficiency: args.efficiency,
      skipRewardPerVote: args.skipRewardPerVote,
      chunkSize: args.chunkSize,
    });
  },
});
