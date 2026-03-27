import { subtask, task, types } from "hardhat/config";
import { getSigner } from "../../utils/signers";
import { manageBribes } from "../poolBooster";

const log = require("../../utils/logger")("action:manageBribes");

subtask(
  "manageCurvePoolBoosterBribes",
  "Calls manageBribes on the CurvePoolBoosterBribesModule and calculates the rewards per vote based on the target efficiency"
)
  .addOptionalParam(
    "efficiency",
    "Target efficiency (0-10, e.g. 1 for 100%, 0.5 for 50%)",
    "1",
    types.string
  )
  .addOptionalParam(
    "skipRewardPerVote",
    "Skip setting RewardPerVote (pass array of zeros)",
    false,
    types.boolean
  )
  .addOptionalParam(
    "chunkSize",
    "Number of pool boosters to manage per transaction",
    4,
    types.int
  )
  .setAction(async (taskArgs: any) => {
    const signer = await getSigner();

    log(
      `Managing max reward per vote with target efficiency ${taskArgs.efficiency}, skip reward per vote ${taskArgs.skipRewardPerVote}, and chunk size ${taskArgs.chunkSize}`
    );
    await manageBribes({
      signer,
      provider: signer.provider!,
      targetEfficiency: taskArgs.efficiency,
      skipRewardPerVote: taskArgs.skipRewardPerVote,
      chunkSize: taskArgs.chunkSize,
    });
  });

task("manageCurvePoolBoosterBribes").setAction(async (_, __, runSuper) => {
  return runSuper();
});
