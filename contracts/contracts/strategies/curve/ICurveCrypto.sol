// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICurveCrypto {
    function add_liquidity(uint256[3] calldata amounts, uint256 min_mint_amount)
        external
        returns (uint256);

    function add_liquidity(
        uint256[3] calldata amounts,
        uint256 min_mint_amount,
        bool use_eth
    ) external returns (uint256);

    function add_liquidity(
        uint256[3] calldata amounts,
        uint256 min_mint_amount,
        bool use_eth,
        address receiver
    ) external returns (uint256);

    function remove_liquidity(uint256 _amount, uint256[3] calldata min_amounts)
        external
        returns (uint256[3] memory);

    function remove_liquidity(
        uint256 _amount,
        uint256[3] calldata min_amounts,
        bool use_eth
    ) external returns (uint256[3] memory);

    function remove_liquidity(
        uint256 _amount,
        uint256[3] calldata min_amounts,
        bool use_eth,
        address receiver
    ) external returns (uint256[3] memory);

    function remove_liquidity(
        uint256 _amount,
        uint256[3] calldata min_amounts,
        bool use_eth,
        address receiver,
        bool claim_admin_fees
    ) external returns (uint256[3] memory);

    function remove_liquidity_one_coin(
        uint256 token_amount,
        uint256 i,
        uint256 min_amount
    ) external returns (uint256);

    function remove_liquidity_one_coin(
        uint256 token_amount,
        uint256 i,
        uint256 min_amount,
        bool use_eth
    ) external returns (uint256);

    function remove_liquidity_one_coin(
        uint256 token_amount,
        uint256 i,
        uint256 min_amount,
        bool use_eth,
        address receiver
    ) external returns (uint256);

    function calc_token_amount(uint256[3] calldata amounts, bool deposit)
        external
        view
        returns (uint256);

    function lp_price() external view returns (uint256);

    function get_virtual_price() external view returns (uint256);

    function price_oracle(uint256 k) external view returns (uint256);

    function last_prices(uint256 k) external view returns (uint256);

    function price_scale(uint256 k) external view returns (uint256);

    function fee() external view returns (uint256);

    function calc_withdraw_one_coin(uint256 token_amount, uint256 i)
        external
        view
        returns (uint256);

    function calc_token_fee(uint256[3] calldata amounts, uint256[3] calldata xp)
        external
        view
        returns (uint256);

    function A() external view returns (uint256);

    function gamma() external view returns (uint256);

    function mid_fee() external view returns (uint256);

    function out_fee() external view returns (uint256);

    function fee_gamma() external view returns (uint256);

    function ma_time() external view returns (uint256);

    function fee_calc(uint256[3] calldata xp) external view returns (uint256);

    function coins(uint256 arg0) external view returns (address);

    function balances(uint256 arg0) external view returns (uint256);

    function virtual_price() external view returns (uint256);
}
