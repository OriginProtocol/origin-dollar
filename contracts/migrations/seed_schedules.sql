-- contracts/migrations/seed_schedules.sql
-- Apply against the shared automaton Postgres.
-- Commands match the original contracts/cron/cron-jobs.ts; the container's
-- runContainer spawns them via sh -c in workdir /app.

-- Drop the deprecated plume-only row (superseded by the per-network
-- otoken_addWithdrawalQueueLiquidity_* rows below, whose action it called no
-- longer exists). Runs every boot; idempotent — no-op once gone.
DELETE FROM schedules
WHERE product = 'origin-dollar'
  AND name = 'otoken_oethp_addWithdrawalQueueLiquidity';

INSERT INTO schedules (product, name, command, cron_expr, timezone, enabled, note) VALUES
('origin-dollar', 'manage_merkle_morpho_bribe',               'cd /app && pnpm hardhat manageMerklBribes --network mainnet',            '30 13 * * 3',           'UTC', false, 'permissioned'),
('origin-dollar', 'manage_curve_pb_mainnet',                  'cd /app && pnpm hardhat manageBribes --network mainnet',                 '30 09 * * 5',           'UTC', false, 'permissioned'),
('origin-dollar', 'update_votemarket_epochs',                 'cd /app && pnpm hardhat updateVotemarketEpochs --network arbitrumOne',   '0 6 * * 5',             'UTC', false, 'permissioned'),
('origin-dollar', 'OETHandOUSD_harvest_CRV_MOPRHO_native_staking','cd /app && pnpm hardhat harvest --network mainnet',                  '25 11,23 * * *',        'UTC', false, NULL),
('origin-dollar', 'OETH_native_staking_accounting',           'cd /app && pnpm hardhat doAccounting --network mainnet',                 '30 23 * * *',           'UTC', false, 'permissioned'),
('origin-dollar', 'manage_pass_through',                      'cd /app && pnpm hardhat managePassThrough --network mainnet',            '30 12 * * 0',           'UTC', false, NULL),
('origin-dollar', 'claim_bribes_base',                        'cd /app && pnpm hardhat claimBribes --network base',                     '30 10 * * 4',           'UTC', false, 'permissioned'),
('origin-dollar', 'manage_bribes_base',                       'cd /app && pnpm hardhat manageMerklBribes --network base',               '35 13 * * 3',           'UTC', false, 'permissioned'),
('origin-dollar', 'sonic_staking_request_withdraw',           'cd /app && pnpm hardhat sonicUndelegate --network sonic',                '35 3,9,15,21 * * *',    'UTC', false, 'permissioned'),
('origin-dollar', 'sonic_staking_claim_withdraw',             'cd /app && pnpm hardhat sonicClaimWithdrawals --network sonic',          '58 */2 * * *',          'UTC', false, 'permissioned'),
('origin-dollar', 'healthcheck',                              'cd /app && pnpm hardhat healthcheck --network mainnet',                  '*/5 * * * *',           'UTC', false, NULL),
('origin-dollar', 'daily_snap_balances',                      'cd /app && pnpm hardhat snapBalances --network mainnet --consol true',   '2 0 * * *',             'UTC', false, 'Remove --consol true once consolidation is finished'),
('origin-dollar', 'daily_verify_balances',                    'cd /app && pnpm hardhat verifyBalances --network mainnet --consol true', '6 0 * * *',             'UTC', false, 'Remove --consol true once consolidation is finished'),
('origin-dollar', 'daily_verify_deposits',                    'cd /app && pnpm hardhat verifyDeposits --network mainnet',               '11 */4 * * *',          'UTC', false, 'Disabled until consolidations done'),
('origin-dollar', 'daily_auto_validator_deposits',            'cd /app && pnpm hardhat autoValidatorDeposits --network mainnet',        '14 1 * * *',            'UTC', false, 'Do not enable — deposit queue is 50 days long'),
('origin-dollar', 'daily_auto_validator_withdrawals',         'cd /app && pnpm hardhat autoValidatorWithdrawals --network mainnet',     '24 1 * * *',            'UTC', false, 'Do not enable — AMO covers liquidity'),
('origin-dollar', 'stake_validator',                          'cd /app && pnpm hardhat stakeValidator --network mainnet',               '0 0 1 1 *',             'UTC', false, 'Manual validator staking. Provide amount, pubkey, sig, deposit-message-root, and optional consol.'),
('origin-dollar', 'remove_validator',                         'cd /app && pnpm hardhat removeValidator --network mainnet',              '0 0 1 1 *',             'UTC', false, 'Manual validator removal. Provide operatorids, pubkey, and optional consol.'),
('origin-dollar', 'otoken_os_collectAndRelease',              'cd /app && pnpm hardhat otokenOsCollectAndRelease --network sonic',      '55 23 * * *',           'UTC', false, NULL),
('origin-dollar', 'otoken_ousd_autoWithdrawal',               'cd /app && pnpm hardhat otokenOusdAutoWithdrawal --network mainnet',     '35 11,23 * * *',        'UTC', false, NULL),
('origin-dollar', 'otoken_oethb_updateWoethPrice',            'cd /app && pnpm hardhat otokenOethbUpdateWoethPrice --network base',     '30 21 * * *',           'UTC', false, NULL),
('origin-dollar', 'otoken_addWithdrawalQueueLiquidity_mainnet', 'cd /app && pnpm hardhat otokenAddWithdrawalQueueLiquidity --network mainnet', '20 0 * * *',     'UTC', false, NULL),
('origin-dollar', 'otoken_addWithdrawalQueueLiquidity_base',    'cd /app && pnpm hardhat otokenAddWithdrawalQueueLiquidity --network base',    '30 0 * * *',     'UTC', false, NULL),
('origin-dollar', 'otoken_addWithdrawalQueueLiquidity_sonic',   'cd /app && pnpm hardhat otokenAddWithdrawalQueueLiquidity --network sonic',   '35 0 * * *',     'UTC', false, NULL),
('origin-dollar', 'otoken_addWithdrawalQueueLiquidity_plume',   'cd /app && pnpm hardhat otokenAddWithdrawalQueueLiquidity --network plume',   '25 0 * * *',     'UTC', false, NULL),
('origin-dollar', 'otoken_oethb_rebase',                      'cd /app && pnpm hardhat otokenOethbRebase --network base',               '25 9,21 * * *',         'UTC', false, NULL),
('origin-dollar', 'otoken_os_sonicRestakeRewards',            'cd /app && pnpm hardhat otokenOsSonicRestakeRewards --network sonic',    '52 22 * * *',           'UTC', false, NULL),
('origin-dollar', 'cross_chain_balance_update_base',          'cd /app && pnpm hardhat crossChainBalanceUpdateBase --network base',     '40 7,15,23 * * *',      'UTC', false, 'permissioned'),
('origin-dollar', 'cross_chain_balance_update_hyperevm',      'cd /app && pnpm hardhat crossChainBalanceUpdateHyperevm --network hyperevm', '50 7,15,23 * * *',  'UTC', false, 'permissioned'),
('origin-dollar', 'cross_chain_base_mainnet',                 'cd /app && pnpm hardhat relayCCTPMessage --network base',                '27 2,8,14,20 * * *',    'UTC', false, 'permissioned'),
('origin-dollar', 'cross_chain_mainnet_base',                 'cd /app && pnpm hardhat relayCCTPMessage --network mainnet',             '43 4,10,16,22 * * *',   'UTC', false, 'permissioned'),
('origin-dollar', 'cross_chain_hyper_mainnet',                'cd /app && pnpm hardhat crossChainRelayHyperEVM --network hyperevm',     '17 1,6,11,16,21 * * *', 'UTC', false, 'permissioned'),
('origin-dollar', 'cross_chain_mainnet_hyper',                'cd /app && pnpm hardhat crossChainRelayHyperEVM --network mainnet',      '7 3,8,13,18,23 * * *',  'UTC', false, 'permissioned'),
('origin-dollar', 'claim_ssv_rewards',                        'cd /app && pnpm hardhat claimSSVRewards --network mainnet',              '45 0 1 * *',            'UTC', false, NULL),
('origin-dollar', 'otoken_ousd_oeth_rebase',                  'cd /app && pnpm hardhat otokenOusdOethRebase --network mainnet',         '45 11,23 * * *',        'UTC', false, NULL),
('origin-dollar', 'ogn_claimAndForwardRewards',               'cd /app && pnpm hardhat ognClaimAndForwardRewards --network mainnet',    '50 0 * * 2',            'UTC', false, NULL),
('origin-dollar', 'otoken_oethb_harvest',                     'cd /app && pnpm hardhat otokenOethbHarvest --network base',              '55 11 * * *',           'UTC', false, NULL),
('origin-dollar', 'module_rebase_mainnet',                    'cd /app && pnpm hardhat permissionedRebase --network mainnet',           '15 10,22 * * *',        'UTC', false, NULL),
('origin-dollar', 'module_rebase_base',                       'cd /app && pnpm hardhat permissionedRebase --network base',              '15 10,22 * * *',        'UTC', false, NULL),
('origin-dollar', 'module_rebase_sonic',                      'cd /app && pnpm hardhat permissionedRebase --network sonic',             '15 10,22 * * *',        'UTC', false, NULL)
ON CONFLICT (product, name) DO NOTHING;
