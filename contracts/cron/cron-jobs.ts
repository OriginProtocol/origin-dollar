import type { CronJob } from "./render-crontab";

export const cronJobs: CronJob[] = [
  {
    name: "manage_merkle_morpho_bribe",
    schedule: "0 13 * * 3",
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat manageMerklBribes --network mainnet",
  },
  {
    name: "manage_curve_pb_mainnet",
    schedule: "0 09 * * 5",
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat manageBribes --network mainnet",
  },
  {
    name: "OETHandOUSD_harvest_CRV_MOPRHO_native_staking",
    schedule: "40 11,23 * * *",
    enabled: false,
    permmissioned: false,
    command: "cd /app && pnpm hardhat harvest --network mainnet",
  },
  {
    name: "OETH_native_staking_accounting",
    schedule: "430 23 * * *",
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat doAccounting --network mainnet",
  },
  {
    name: "manage_pass_through",
    schedule: "0 12 * * 0",
    enabled: false,
    permmissioned: false,
    command: "cd /app && pnpm hardhat managePassThrough --network mainnet",
  },
  {
    name: "claim_bribes_base",
    schedule: "00 10 * * 4",
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat claimBribes --network base",
  },
  {
    name: "manage_bribes_base",
    schedule: "0 13 * * 3",
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat manageMerklBribes --network base",
  },
  {
    name: "sonic_staking_request_withdraw",
    schedule: "50 3,9,15,21 * * *",
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat sonicUndelegate --network sonic",
  },
  {
    name: "sonic_staking_claim_withdraw",
    schedule: "58 */2 * * *",
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat sonicClaimWithdrawals --network sonic",
  },
  {
    name: "healthcheck",
    schedule: "*/5 * * * *",
    enabled: true,
    command:
      "cd /app && pnpm hardhat healthcheck --network ${HARDHAT_NETWORK:-mainnet}",
  },
  {
    name: "hourly_snap_balances",
    schedule: "0 * * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat snapBalances --network ${HARDHAT_NETWORK:-mainnet}",
  },
  {
    name: "hourly_verify_balances",
    schedule: "8 * * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat verifyBalances --network ${HARDHAT_NETWORK:-mainnet}",
  },
  {
    name: "hourly_verify_deposits",
    schedule: "10 * * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat verifyDeposits --network ${HARDHAT_NETWORK:-mainnet}",
  },
  {
    name: "hourly_auto_validator_deposits",
    schedule: "12 * * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat autoValidatorDeposits --network ${HARDHAT_NETWORK:-mainnet}",
  },
  {
    name: "hourly_auto_validator_withdrawals",
    schedule: "14 * * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat autoValidatorWithdrawals --network ${HARDHAT_NETWORK:-mainnet}",
  },
  {
    name: "daily_rebase_mainnet_oeth",
    schedule: "0 0 * * *",
    enabled: true,
    command: "cd /app && pnpm hardhat rebase --network mainnet --symbol OETH",
  },
  {
    name: "daily_rebase_mainnet_ousd",
    schedule: "10 0 * * *",
    enabled: true,
    command: "cd /app && pnpm hardhat rebase --network mainnet --symbol OUSD",
  },
  {
    name: "daily_rebase_base_oeth",
    schedule: "20 0 * * *",
    enabled: true,
    command: "cd /app && pnpm hardhat rebase --network base --symbol OETH",
  },
  {
    name: "otoken_os_collectAndRelease",
    schedule: "50 23 * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat otokenOsCollectAndRelease --network sonic",
  },
  {
    name: "otoken_ousd_autoWithdrawal",
    schedule: "40 11,23 * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat otokenOusdAutoWithdrawal --network mainnet",
  },
  {
    name: "otoken_oethb_updateWoethPrice",
    schedule: "10 21 * * *",
    enabled: false,
    permmissioned: false,
    command:
      "cd /app && pnpm hardhat otokenOethbUpdateWoethPrice --network base",
  },
  {
    name: "otoken_oethp_addWithdrawalQueueLiquidity",
    schedule: "5 0 * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat otokenOethpAddWithdrawalQueueLiquidity --network mainnet",
  },
  {
    name: "otoken_oethb_rebase",
    schedule: "25 9,21 * * *",
    enabled: false,
    command: "cd /app && pnpm hardhat otokenOethbRebase --network base",
  },
  {
    name: "otoken_os_sonicRestakeRewards",
    schedule: "55 23 * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat otokenOsSonicRestakeRewards --network sonic",
  },
  {
    name: "crossChainBalanceUpdate-base",
    schedule: "15 7,15,23 * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat crossChainBalanceUpdateBase --network base",
  },
  {
    name: "crossChainBalanceUpdate-hyperevm",
    schedule: "15 7,15,23 * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat crossChainBalanceUpdateHyperevm --network hyperevm",
  },
  {
    name: "otoken_ousd_oeth_rebase",
    schedule: "50 11,23 * * *",
    enabled: false,
    command: "cd /app && pnpm hardhat otokenOusdOethRebase --network mainnet",
  },
  {
    name: "ogn_claimAndForwardRewards",
    schedule: "0 0 * * 2",
    enabled: false,
    command:
      "cd /app && pnpm hardhat ognClaimAndForwardRewards --network mainnet",
  },
  {
    name: "otoken_oethb_harvest",
    schedule: "50 11 * * *",
    enabled: false,
    command: "cd /app && pnpm hardhat otokenOethbHarvest --network base",
  },
];
