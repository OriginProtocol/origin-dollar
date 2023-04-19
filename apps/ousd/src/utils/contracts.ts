import { ethers } from "ethers";
import addresses from "../constants/contractAddresses";
import ogvAbi from "../constants/mainnetAbi/ogv.json";
import veogvAbi from "../constants/mainnetAbi/veogv.json";
import ousdAbi from "../constants/mainnetAbi/ousd.json";
import vaultAbi from "../constants/mainnetAbi/vault.json";
import dripperAbi from "../constants/mainnetAbi/dripper.json";
import ContractStore from "../stores/ContractStore";

export const getContract = (address, abi, provider) => {
  try {
    return new ethers.Contract(address, abi, provider);
  } catch (e) {
    console.error(
      `Error creating contract in [getContract] with address:${address} abi:${JSON.stringify(
        abi
      )}`
    );
    throw e;
  }
};

export const fetchTvl = async (vault, dripper) => {
  const tvl = await vault?.totalValue().then((r) => Number(r) / 10 ** 18);
  const rewards = await dripper
    ?.availableFunds()
    .then((r) => Number(r) / 10 ** 6);
  ContractStore.update((s) => {
    s.ousdTvl = tvl + rewards;
  });
  return tvl + rewards;
};

export const setupContracts = () => {
  const provider = new ethers.providers.StaticJsonRpcProvider(
    process.env.NEXT_PUBLIC_ETHEREUM_RPC_PROVIDER,
    {
      chainId: parseInt(
        process.env.NEXT_PUBLIC_ETHEREUM_RPC_CHAIN_ID || "1",
        10
      ),
      name: "mainnet",
    }
  );

  const ousd = getContract(addresses.mainnet.OUSDProxy, ousdAbi, provider);
  const vault = getContract(addresses.mainnet.Vault, vaultAbi, provider);
  const dripper = getContract(addresses.mainnet.Dripper, dripperAbi, provider);
  const ogv = getContract(addresses.mainnet.OGV, ogvAbi, provider);
  const veogv = getContract(addresses.mainnet.veOGV, veogvAbi, provider);

  const contractsToExport = {
    ousd,
    vault,
    dripper,
    ogv,
    veogv,
  };

  return contractsToExport;
};
