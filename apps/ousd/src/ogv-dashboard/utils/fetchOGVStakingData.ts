import { BigNumber } from "ethers";

interface EthRequest {
  method: string;
  params: any[];
  id: number;
  jsonrpc: string;
}

const createRequest = (
  method: string,
  params: any[],
  id: number
): EthRequest => {
  return {
    method,
    params,
    id,
    jsonrpc: "2.0",
  };
};

const calcXDaysAgoBlock = (
  x: number,
  startingBlock: number,
  ethBlocksPerDay: number
): string => {
  return "0x" + (startingBlock - x * ethBlocksPerDay).toString(16);
};

const fetchOGVStakingData = async (
  days: number,
  ethBlocksPerDay: number,
  currentBlock: number,
  ogvContractAddress: string,
  stakingContractOgvBalanceSlot: BigNumber,
  ogvTotalSupplySlot: BigNumber
) => {
  const reqs = [];
  for (let i = 0; i < days; i++) {
    reqs.push(
      createRequest(
        "eth_getStorageAt",
        [
          ogvContractAddress,
          stakingContractOgvBalanceSlot.toHexString(),
          calcXDaysAgoBlock(i, currentBlock, ethBlocksPerDay),
        ],
        i
      )
    );
  }

  for (let i = 0; i < days; i++) {
    reqs.push(
      createRequest(
        "eth_getStorageAt",
        [
          ogvContractAddress,
          ogvTotalSupplySlot.toHexString(),
          calcXDaysAgoBlock(i, currentBlock, ethBlocksPerDay),
        ],
        i + days
      )
    );
  }

  for (let i = 0; i < days; i++) {
    reqs.push(
      createRequest(
        "eth_getBlockByNumber",
        [calcXDaysAgoBlock(i, currentBlock, ethBlocksPerDay), true],
        i + days * 2
      )
    );
  }

  const res = await fetch(process.env.NEXT_PUBLIC_ETHEREUM_RPC_PROVIDER, {
    method: "POST",
    body: JSON.stringify(reqs),
    headers: { "Content-Type": "application/json" },
  });

  const data = await res.json();
  return data;
};

export default fetchOGVStakingData;
