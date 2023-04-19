import { useEffect, useState } from "react";
import addresses from "../constants/contractAddresses";
import { useStoreState } from "pullstate";
import ContractStore from "../stores/ContractStore";
import { BigNumber, utils } from "ethers";

export const useOgv = () => {
  const { ogv, veogv } = useStoreState(ContractStore, (s) => s.contracts);
  const [totalStaked, setTotalStaked] = useState<string>();
  const [totalSupply, setTotalSupply] = useState<string>();
  const [totalVeSupply, setTotalVeSupply] = useState<string>();
  const [optionalLockupBalance, setOptionalLockupBalance] = useState<string>();
  const [mandatoryLockupBalance, setMandatoryLockupBalance] =
    useState<string>();

  const burnBlock = 15724869;

  useEffect(() => {
    if (!(ogv && veogv)) {
      return;
    }
    const fetchStakedOgv = async () => {
      const staked: BigNumber = await ogv.balanceOf(addresses.mainnet.veOGV);

      const supply: BigNumber = await ogv.totalSupply();
      const optional: BigNumber = await ogv.balanceOf(
        addresses.mainnet.optionalLockupDistributor
      );
      const mandatory: BigNumber = await ogv.balanceOf(
        addresses.mainnet.mandatoryLockupDistributor
      );

      const totalVe: BigNumber = await veogv.totalSupply();

      setTotalStaked(utils.formatUnits(staked, 18));
      setTotalSupply(utils.formatUnits(supply, 18));
      setOptionalLockupBalance(utils.formatUnits(optional, 18));
      setMandatoryLockupBalance(utils.formatUnits(mandatory, 18));
      setTotalVeSupply(utils.formatUnits(totalVe, 18));

      const burnedOptional = await ogv.balanceOf(
        addresses.mainnet.optionalLockupDistributor,
        {
          blockTag: burnBlock,
        }
      );
      const burnedMandatory = await ogv.balanceOf(
        addresses.mainnet.mandatoryLockupDistributor,
        {
          blockTag: burnBlock,
        }
      );
      setOptionalLockupBalance(utils.formatUnits(burnedOptional, 18));
      setMandatoryLockupBalance(utils.formatUnits(burnedMandatory, 18));
    };
    fetchStakedOgv();
  }, [ogv, veogv]);

  return {
    totalStaked,
    totalSupply,
    totalVeSupply,
    optionalLockupBalance,
    mandatoryLockupBalance,
  };
};

export default useOgv;
