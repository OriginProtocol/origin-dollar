import { ethers } from "ethers";
import addresses from "../../utils/addresses";

export type RoleName =
  | "deployerAddr"
  | "governorAddr"
  | "governorFiveAddr"
  | "governorSixAddr"
  | "timelockAddr"
  | "guardianAddr"
  | "adjusterAddr"
  | "strategistAddr"
  | "multichainStrategistAddr"
  | "registratorAddr";

const DEPLOYER = "0x3Ba227D87c2A7aB89EAaCEFbeD9bfa0D15Ad249A";
const MULTICHAIN_STRATEGIST = "0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971";
const MAINNET_GOVERNOR = "0x72426ba137dec62657306b12b1e869d43fec6ec7";
const MAINNET_ADMIN = "0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899";
const MAINNET_TIMELOCK = "0x35918cDE7233F2dD33fA41ae3Cb6aE0e42E0e69F";
const MAINNET_RELAYER = "0x4b91827516f79d6F6a1F292eD99671663b09169a";
const CHAIN_ADMIN = "0x92A19381444A001d62cE67BaFF066fA1111d7202";
const SONIC_ADMIN = "0xAdDEA7933Db7d83855786EB43a238111C69B00b6";
const SONIC_STRATEGIST = "0x63cdd3072F25664eeC6FAEFf6dAeB668Ea4de94a";
const HOODI_RELAYER = "0x419B6BdAE482f41b8B194515749F3A2Da26d583b";

const roleOverrides: Record<number, Partial<Record<RoleName, string>>> = {
  1: {
    deployerAddr: DEPLOYER,
    governorAddr: MAINNET_GOVERNOR,
    governorFiveAddr: "0x3cdd07c16614059e66344a7b579dab4f9516c0b6",
    governorSixAddr: addresses.mainnet.GovernorSix,
    timelockAddr: MAINNET_TIMELOCK,
    guardianAddr: MAINNET_ADMIN,
    adjusterAddr: DEPLOYER,
    strategistAddr: MULTICHAIN_STRATEGIST,
    registratorAddr: MAINNET_RELAYER,
  },
  42161: { deployerAddr: DEPLOYER },
  8453: {
    deployerAddr: DEPLOYER,
    governorAddr: CHAIN_ADMIN,
    timelockAddr: addresses.base.timelock,
    guardianAddr: CHAIN_ADMIN,
    strategistAddr: MULTICHAIN_STRATEGIST,
  },
  146: {
    deployerAddr: DEPLOYER,
    governorAddr: SONIC_ADMIN,
    timelockAddr: addresses.sonic.timelock,
    guardianAddr: SONIC_ADMIN,
    strategistAddr: SONIC_STRATEGIST,
  },
  98866: {
    deployerAddr: DEPLOYER,
    governorAddr: CHAIN_ADMIN,
    timelockAddr: addresses.plume.timelock,
    guardianAddr: MULTICHAIN_STRATEGIST,
    strategistAddr: MULTICHAIN_STRATEGIST,
  },
  560048: {
    deployerAddr: DEPLOYER,
    governorAddr: HOODI_RELAYER,
    guardianAddr: HOODI_RELAYER,
    strategistAddr: HOODI_RELAYER,
    registratorAddr: HOODI_RELAYER,
  },
  999: {
    deployerAddr: DEPLOYER,
    governorAddr: CHAIN_ADMIN,
    timelockAddr: addresses.hyperevm.timelock,
    guardianAddr: MULTICHAIN_STRATEGIST,
    strategistAddr: MULTICHAIN_STRATEGIST,
  },
};

export function rolesFor(chainId: number): Record<RoleName, string> {
  const zero = ethers.constants.AddressZero;
  return {
    deployerAddr: DEPLOYER,
    governorAddr: zero,
    governorFiveAddr: zero,
    governorSixAddr: zero,
    timelockAddr: zero,
    guardianAddr: zero,
    adjusterAddr: zero,
    strategistAddr: MULTICHAIN_STRATEGIST,
    multichainStrategistAddr: MULTICHAIN_STRATEGIST,
    registratorAddr: MAINNET_RELAYER,
    ...roleOverrides[chainId],
  };
}
