import type { CronJob } from "./render-crontab";

export const cronJobs: CronJob[] = [
  {
    name: "manage_merkle_morpho_bribe",
    schedule: "30 13 * * 3",
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat manageMerklBribes --network mainnet",
  },
  {
    name: "manage_curve_pb_mainnet",
    schedule: "30 09 * * 5",
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat manageBribes --network mainnet",
  },
  {
    name: "update_votemarket_epochs",
    schedule: "0 6 * * 5",
    enabled: false,
    permmissioned: true,
    command:
      "cd /app && pnpm hardhat updateVotemarketEpochs --network arbitrumOne",
  },
  {
    name: "OETHandOUSD_harvest_CRV_MOPRHO_native_staking",
    schedule: "25 11,23 * * *",
    enabled: false,
    permmissioned: false,
    command: "cd /app && pnpm hardhat harvest --network mainnet",
  },
  {
    name: "OETH_native_staking_accounting",
    schedule: "30 23 * * *",
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat doAccounting --network mainnet",
  },
  {
    name: "manage_pass_through",
    schedule: "30 12 * * 0",
    enabled: false,
    permmissioned: false,
    command: "cd /app && pnpm hardhat managePassThrough --network mainnet",
  },
  {
    name: "claim_bribes_base",
    schedule: "30 10 * * 4",
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat claimBribes --network base",
  },
  {
    name: "manage_bribes_base",
    schedule: "35 13 * * 3",
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat manageMerklBribes --network base",
  },
  {
    name: "sonic_staking_request_withdraw",
    schedule: "35 3,9,15,21 * * *",
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
    schedule: "2 * * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat snapBalances --network ${HARDHAT_NETWORK:-mainnet}",
  },
  {
    name: "hourly_verify_balances",
    schedule: "6 * * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat verifyBalances --network ${HARDHAT_NETWORK:-mainnet}",
  },
  {
    name: "hourly_verify_deposits",
    schedule: "11 * * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat verifyDeposits --network ${HARDHAT_NETWORK:-mainnet}",
  },
  {
    name: "hourly_auto_validator_deposits",
    schedule: "16 * * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat autoValidatorDeposits --network ${HARDHAT_NETWORK:-mainnet}",
  },
  {
    name: "hourly_auto_validator_withdrawals",
    schedule: "21 * * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat autoValidatorWithdrawals --network ${HARDHAT_NETWORK:-mainnet}",
  },
  {
    name: "daily_rebase_mainnet_oeth",
    schedule: "30 0 * * *",
    enabled: true,
    command: "cd /app && pnpm hardhat rebase --network mainnet --symbol OETH",
  },
  {
    name: "daily_rebase_mainnet_ousd",
    schedule: "35 0 * * *",
    enabled: true,
    command: "cd /app && pnpm hardhat rebase --network mainnet --symbol OUSD",
  },
  {
    name: "daily_rebase_base_oeth",
    schedule: "40 0 * * *",
    enabled: true,
    command: "cd /app && pnpm hardhat rebase --network base --symbol OETH",
  },
  {
    name: "otoken_os_collectAndRelease",
    schedule: "55 23 * * *",
    enabled: false,
    permmissioned: false,
    command:
      "cd /app && pnpm hardhat otokenOsCollectAndRelease --network sonic",
  },
  {
    name: "otoken_ousd_autoWithdrawal",
    schedule: "35 11,23 * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat otokenOusdAutoWithdrawal --network mainnet",
  },
  {
    name: "otoken_oethb_updateWoethPrice",
    schedule: "30 21 * * *",
    enabled: false,
    permmissioned: false,
    command:
      "cd /app && pnpm hardhat otokenOethbUpdateWoethPrice --network base",
  },
  {
    name: "otoken_oethp_addWithdrawalQueueLiquidity",
    schedule: "25 0 * * *",
    enabled: false,
    permmissioned: false,
    command:
      "cd /app && pnpm hardhat otokenOethpAddWithdrawalQueueLiquidity --network plume",
  },
  {
    name: "otoken_oethb_rebase",
    schedule: "25 9,21 * * *",
    enabled: false,
    permmissioned: false,
    command: "cd /app && pnpm hardhat otokenOethbRebase --network base",
  },
  {
    name: "otoken_os_sonicRestakeRewards",
    schedule: "52 22 * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat otokenOsSonicRestakeRewards --network sonic",
  },
  {
    name: "crossChainBalanceUpdate-base",
    schedule: "40 7,15,23 * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat crossChainBalanceUpdateBase --network base",
  },
  {
    name: "crossChainBalanceUpdate-hyperevm",
    schedule: "50 7,15,23 * * *",
    enabled: false,
    command:
      "cd /app && pnpm hardhat crossChainBalanceUpdateHyperevm --network hyperevm",
  },
  {
    name: "claim_ssv_rewards",
    schedule: "45 0 1 * *",
    enabled: false,
    command: "cd /app && pnpm hardhat claimSSVRewards --network mainnet",
  },
  {
    name: "otoken_ousd_oeth_rebase",
    schedule: "45 11,23 * * *",
    enabled: false,
    command: "cd /app && pnpm hardhat otokenOusdOethRebase --network mainnet",
  },
  {
    name: "ogn_claimAndForwardRewards",
    schedule: "50 0 * * 2",
    enabled: false,
    command:
      "cd /app && pnpm hardhat ognClaimAndForwardRewards --network mainnet",
  },
  {
    name: "otoken_oethb_harvest",
    schedule: "55 11 * * *",
    enabled: false,
    permmissioned: false,
    command: "cd /app && pnpm hardhat otokenOethbHarvest --network base",
  },
];
