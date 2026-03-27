import { subtask, task, types } from "hardhat/config";
import { getSigner } from "../../utils/signers";
import { undelegateValidator } from "../../utils/sonicActions";

subtask("sonicUndelegate", "Remove liquidity from a Sonic validator")
  .addOptionalParam(
    "id",
    "Validator identifier. 15, 16, 17 or 18",
    undefined,
    types.int
  )
  .addOptionalParam(
    "amount",
    "Amount of liquidity to remove",
    undefined,
    types.float
  )
  .addOptionalParam(
    "buffer",
    "Percentage of total assets to keep as buffer in basis points. 100 = 1%",
    50,
    types.float
  )
  .setAction(async (taskArgs: any) => {
    const signer = await getSigner();
    await undelegateValidator({
      ...taskArgs,
      bufferPct: taskArgs.buffer,
      signer,
    });
  });

task("sonicUndelegate").setAction(async (_, __, runSuper) => {
  return runSuper();
});
