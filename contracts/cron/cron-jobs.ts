import type { CronJob } from "./render-crontab";

export const cronJobs: CronJob[] = [
  {
    name: "manage_merkle_morpho_bribe",
    schedule: "30 13 * * 3", // weekly (Wednesday)
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat manageMerklBribes --network mainnet",
  },
  {
    name: "manage_curve_pb_mainnet",
    schedule: "30 09 * * 5", // weekly (Friday)
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat manageBribes --network mainnet",
  },
  {
    name: "update_votemarket_epochs",
    schedule: "0 6 * * 5", // weekly (Friday)
    enabled: false,
    permmissioned: true,
    command:
      "cd /app && pnpm hardhat updateVotemarketEpochs --network arbitrumOne",
  },
  {
    name: "OETHandOUSD_harvest_CRV_MOPRHO_native_staking",
    schedule: "25 11,23 * * *", // twice daily
    enabled: false,
    permmissioned: false,
    command: "cd /app && pnpm hardhat harvest --network mainnet",
  },
  {
    name: "OETH_native_staking_accounting",
    schedule: "30 23 * * *", // daily
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat doAccounting --network mainnet",
  },
  {
    name: "manage_pass_through",
    schedule: "30 12 * * 0", // weekly (Sunday)
    enabled: false,
    permmissioned: false,
    command: "cd /app && pnpm hardhat managePassThrough --network mainnet",
  },
  {
    name: "claim_bribes_base",
    schedule: "30 10 * * 4", // weekly (Thursday)
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat claimBribes --network base",
  },
  {
    name: "manage_bribes_base",
    schedule: "35 13 * * 3", // weekly (Wednesday)
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat manageMerklBribes --network base",
  },
  {
    name: "sonic_staking_request_withdraw",
    schedule: "35 3,9,15,21 * * *", // 4 times daily
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat sonicUndelegate --network sonic",
  },
  {
    name: "sonic_staking_claim_withdraw",
    schedule: "58 */2 * * *", // every 2 hours (12 times daily)
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat sonicClaimWithdrawals --network sonic",
  },
  {
    name: "healthcheck",
    schedule: "*/5 * * * *", // every 5 minutes
    enabled: true,
    command:
      "cd /app && pnpm hardhat healthcheck --network mainnet",
  },
  {
    name: "daily_snap_balances",
    schedule: "2 0 * * *", // daily
    enabled: false,
    comment: "Remove --consol true once the consolidation is finished",
    command:
      "cd /app && pnpm hardhat snapBalances --network mainnet --consol true",
  },
  {
    name: "daily_verify_balances",
    schedule: "6 0 * * *", // daily
    enabled: false,
    comment: "Remove --consol true once the consolidation is finished",
    command:
      "cd /app && pnpm hardhat verifyBalances --network mainnet --consol true",
  },
  {
    name: "daily_verify_deposits",
    schedule: "11 */4 * * *", // every 4 hours (6 times daily)
    enabled: false,
    comment: "This is disabled until we are finished with consolidations",
    command: "cd /app && pnpm hardhat verifyDeposits --network mainnet",
  },
  {
    name: "daily_auto_validator_deposits",
    schedule: "14 1 * * *", // daily
    enabled: false,
    comment:
      "Don't enable this in the near future as deposit queue is 50 days long.",
    command: "cd /app && pnpm hardhat autoValidatorDeposits --network mainnet",
  },
  {
    name: "daily_auto_validator_withdrawals",
    schedule: "24 1 * * *", // daily
    enabled: false,
    comment:
      "Don't enable this in the near future as deposit queue is 50 days long and we rather use AMO for the liquidity",
    command:
      "cd /app && pnpm hardhat autoValidatorWithdrawals --network mainnet",
  },
  {
    name: "otoken_os_collectAndRelease",
    schedule: "55 23 * * *", // daily
    enabled: false,
    permmissioned: false,
    command:
      "cd /app && pnpm hardhat otokenOsCollectAndRelease --network sonic",
  },
  {
    name: "otoken_ousd_autoWithdrawal",
    schedule: "35 11,23 * * *", // twice daily
    enabled: false,
    command:
      "cd /app && pnpm hardhat otokenOusdAutoWithdrawal --network mainnet",
  },
  {
    name: "otoken_oethb_updateWoethPrice",
    schedule: "30 21 * * *", // daily
    enabled: false,
    permmissioned: false,
    command:
      "cd /app && pnpm hardhat otokenOethbUpdateWoethPrice --network base",
  },
  {
    name: "otoken_oethp_addWithdrawalQueueLiquidity",
    schedule: "25 0 * * *", // daily
    enabled: false,
    permmissioned: false,
    command:
      "cd /app && pnpm hardhat otokenOethpAddWithdrawalQueueLiquidity --network plume",
  },
  {
    name: "otoken_oethb_rebase",
    schedule: "25 9,21 * * *", // twice daily
    enabled: false,
    permmissioned: false,
    command: "cd /app && pnpm hardhat otokenOethbRebase --network base",
  },
  {
    name: "otoken_os_sonicRestakeRewards",
    schedule: "52 22 * * *", // daily
    enabled: false,
    command:
      "cd /app && pnpm hardhat otokenOsSonicRestakeRewards --network sonic",
  },
  {
    name: "cross_chain_balance_update_base",
    schedule: "40 7,15,23 * * *", // 3 times daily
    enabled: false,
    permmissioned: true,
    command:
      "cd /app && pnpm hardhat crossChainBalanceUpdateBase --network base",
  },
  {
    name: "cross_chain_balance_update_hyperevm",
    schedule: "50 7,15,23 * * *", // 3 times daily
    enabled: false,
    permmissioned: true,
    command:
      "cd /app && pnpm hardhat crossChainBalanceUpdateHyperevm --network hyperevm",
  },
  {
    name: "cross_chain_base_mainnet",
    schedule: "27 2,8,14,20 * * *", // 4 times daily
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat relayCCTPMessage --network base",
  },
  {
    name: "cross_chain_mainnet_base",
    schedule: "43 4,10,16,22 * * *", // 4 times daily
    enabled: false,
    permmissioned: true,
    command: "cd /app && pnpm hardhat relayCCTPMessage --network mainnet",
  },
  {
    name: "cross_chain_hyper_mainnet",
    schedule: "17 1,6,11,16,21 * * *", // 5 times daily
    enabled: false,
    permmissioned: true,
    command:
      "cd /app && pnpm hardhat crossChainRelayHyperEVM --network hyperevm",
  },
  {
    name: "cross_chain_mainnet_hyper",
    schedule: "7 3,8,13,18,23 * * *", // 5 times daily
    enabled: false,
    permmissioned: true,
    command:
      "cd /app && pnpm hardhat crossChainRelayHyperEVM --network mainnet",
  },
  {
    name: "claim_ssv_rewards",
    schedule: "45 0 1 * *", // monthly (1st day)
    enabled: false,
    command: "cd /app && pnpm hardhat claimSSVRewards --network mainnet",
  },
  {
    name: "otoken_ousd_oeth_rebase",
    schedule: "45 11,23 * * *", // twice daily
    enabled: false,
    command: "cd /app && pnpm hardhat otokenOusdOethRebase --network mainnet",
  },
  {
    name: "ogn_claimAndForwardRewards",
    schedule: "50 0 * * 2", // weekly (Tuesday)
    enabled: false,
    command:
      "cd /app && pnpm hardhat ognClaimAndForwardRewards --network mainnet",
  },
  {
    name: "otoken_oethb_harvest",
    schedule: "55 11 * * *", // daily
    enabled: false,
    permmissioned: false,
    command: "cd /app && pnpm hardhat otokenOethbHarvest --network base",
  },
];
