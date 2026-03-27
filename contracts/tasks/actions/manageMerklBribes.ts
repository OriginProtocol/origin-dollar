import { subtask, task, types } from "hardhat/config";
import { getSigner } from "../../utils/signers";
import { manageMerklBribes } from "../merklPoolBooster";

const log = require("../../utils/logger")("action:manageMerklBribes");

subtask(
  "manageMerklPoolBoosterBribes",
  "Calls bribeAll on the MerklPoolBoosterBribesModule through the Gnosis Safe"
)
  .addOptionalParam(
    "exclusionList",
    "Comma-separated list of pool booster addresses to exclude",
    "",
    types.string
  )
  .setAction(async (taskArgs: any) => {
    const signer = await getSigner();
    const exclusionList = taskArgs.exclusionList
      ? taskArgs.exclusionList.split(",").map((s: string) => s.trim())
      : [];

    log(`Calling bribeAll with exclusion list: [${exclusionList.join(", ")}]`);
    await manageMerklBribes({
      provider: signer.provider!,
      signer,
      exclusionList,
    });
  });

task("manageMerklPoolBoosterBribes").setAction(async (_, __, runSuper) => {
  return runSuper();
});
