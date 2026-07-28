import { types } from "../lib/action";
import { action } from "../lib/action";
import { getContractAt } from "../lib/contracts";
import addresses from "../../utils/addresses";
import { logTxDetails } from "../../utils/txLogger";

const governorSixAbi = [
  "function queue(uint256 proposalId) external",
  "function execute(uint256 proposalId) external payable",
];

action({
  name: "queueGovernorSixProposal",
  description: "Queue a GovernorSix proposal on mainnet",
  chains: [1],
  params: (t) => {
    t.addParam(
      "propid",
      "GovernorSix proposal id to queue",
      undefined,
      types.string
    );
  },
  run: async ({ signer, log, args }) => {
    const governorSixAddress = (addresses as any).mainnet.GovernorSix;
    const governorSix = await getContractAt(governorSixAbi, governorSixAddress);

    const proposalId = args.propid;
    if (!/^[0-9]+$/.test(proposalId)) {
      throw new Error(`Invalid proposalId: ${proposalId}`);
    }

    log.info(
      `Queueing proposal ${proposalId} on GovernorSix ${governorSixAddress}`
    );
    const tx = await governorSix.connect(signer).queue(proposalId);
    await logTxDetails(tx, `queue(${proposalId})`);
  },
});
