import { types } from "../lib/action";
import { action } from "../lib/action";
import { manageMerklBribes } from "../merklPoolBooster";

action({
  name: "manageMerklBribes",
  description:
    "Calls bribeAll on the MerklPoolBoosterBribesModule through the Gnosis Safe",
  chains: [1, 8453],
  params: (t) => {
    t.addOptionalParam(
      "exclusionList",
      "Comma-separated list of pool booster addresses to exclude",
      "",
      types.string
    );
  },
  run: async ({ signer, log, args }) => {
    const exclusionList = args.exclusionList
      ? args.exclusionList.split(",").map((s: string) => s.trim())
      : [];

    log.info(
      `Calling bribeAll with exclusion list: [${exclusionList.join(", ")}]`
    );
    await manageMerklBribes({
      provider: signer.provider!,
      signer,
      exclusionList,
    });
  },
});
