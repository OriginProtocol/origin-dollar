import { subtask, task } from "hardhat/config";

import { transferTokens } from "../../utils/managePassThrough";
import { getSigner } from "../../utils/signers";

subtask(
  "managePassThrough",
  "Transfer tokens via pass-through mechanism"
).setAction(async () => {
  const signer = await getSigner();
  await transferTokens({ signer });
});

task("managePassThrough").setAction(async (_, __, runSuper) => {
  return runSuper();
});
