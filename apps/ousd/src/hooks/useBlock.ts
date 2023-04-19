import { providers } from "ethers";
import { useEffect, useState } from "react";

const useBlock = () => {
  const [block, setBlock] = useState<providers.Block | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const provider = new providers.JsonRpcProvider(
          process.env.NEXT_PUBLIC_ETHEREUM_RPC_PROVIDER
        );

        const block = await provider.getBlock(await provider.getBlockNumber());
        setBlock(block);
      } catch (error) {
        console.error("Unable to fetch block");
        throw error;
      }
    })();
  }, []);

  return block;
};

export default useBlock;
