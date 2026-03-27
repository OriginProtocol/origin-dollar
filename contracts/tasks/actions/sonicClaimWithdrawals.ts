import { subtask, task } from "hardhat/config";
import { getSigner } from "../../utils/signers";
import { withdrawFromSFC } from "../../utils/sonicActions";

subtask(
  "sonicWithdraw",
  "Withdraw native S from a previously undelegated validator"
).setAction(async () => {
  const signer = await getSigner();
  await withdrawFromSFC({ signer });
});

task("sonicWithdraw").setAction(async (_, __, runSuper) => {
  return runSuper();
});
