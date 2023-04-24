// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICurveETHPool {
    function get_virtual_price() external view returns (uint256);

    function add_liquidity(uint256[2] calldata _amounts, uint256 _min)
        external
        returns (uint256);

    function balances(uint256) external view returns (uint256);

    function calc_token_amount(uint256[2] calldata _amounts, bool _deposit)
        external
        returns (uint256);

    function fee() external view returns (uint256);

    function lp_price() external view returns (uint256);

    function price_oracle() external view returns (uint256);

    function remove_liquidity_one_coin(
        uint256 _amount,
        int128 _index,
        uint256 _minAmount
    ) external;

    function remove_liquidity(
        uint256 _amount,
        uint256[2] calldata _minWithdrawAmounts
    ) external;

    function calc_withdraw_one_coin(uint256 _amount, int128 _index)
        external
        view
        returns (uint256);

    function coins(uint256 _index) external view returns (address);
}
