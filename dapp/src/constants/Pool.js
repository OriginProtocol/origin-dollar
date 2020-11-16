/*
 * Holds Liquidity Mining pool information with properties:
 * - name: pool name as displayed in the dapp
 * - coin_info: coins specific info of the both coins
 *   - name: coin name
 *   - icon: coin icon that needs to be present in images
 *   - contract_address: coin contract address
 *   - allowance:[local dev only] allowance of lp_contract to move coin on user's behalf
 * - type: pool type can be one of:
 *   - main -> main type displayed on the top of pool list
 *   - featured -> featured type displayed below the main pools
 *   - past -> past pool displayed on the bottom of the pool list. No longer gives out OGN
 * - lp_contract_type: type of the contract that is generating the LP tokens
 * - pool_deposits: total deposits of LP tokens into the pool
 * - pool_rate: the weekly rate of OGN tokens handed out
 * - current_apy: TODO
 * - reward_per_block: how much reward per block pool gives out
 * - your_weekly_rate: the amount of OGN user is earning a week with currently staked LP tokens
 * - claimable_ogn: the amount of OGN for the user to claim
 * - staked_lp_tokens: amount of LP tokens user has staked in the contract
 * - lp_tokens: user's balance of the LP tokens
 * - lp_token_allowance: allowanc of pool contract to move the lp_tokens on user's behalf
 * - pool_contract_variable_name: variable name of the contract pool initialized in the contracts.js
 * - lp_contract_variable_name: variable name of the lp contract initialized in the contracts.js
 * - contract: pool contract instance
 * - lpContract: liquidity token contract instance
 */
export const pools = [
  {
    name: 'Uniswap V2: OUSD/USDT',
    coin_one: {
      name: 'OUSD',
      contract_variable_name: 'ousd',
      icon: 'ousd-token-icon.svg',
      // contract_address
      // allowance
    },
    coin_two: {
      name: 'OGN',
      contract_variable_name: 'ogn',
      icon: 'usdt-icon-full.svg',
      // contract_address
      // allowance
    },
    type: 'main',
    lp_contract_type: 'uniswap-v2',
    // pool_deposits
    pool_rate: '500000',
    // current_apy
    // pool_contract_address
    // your_weekly_rate
    // claimable_ogn
    rewards_boost: 2.5,
    // reward_per_block
    // staked_lp_tokens
    // lp_tokens
    // lp_token_allowance
    // contract
    // lpContract
    lp_contract_variable_name: 'uniV2OusdUsdt',
    lp_contract_variable_name_ierc20: 'uniV2OusdUsdt_iErc20',
    lp_contract_variable_name_uniswapPair: 'uniV2OusdUsdt_iUniPair',
    pool_contract_variable_name: 'liquidityOusdUsdt',
  },
]
