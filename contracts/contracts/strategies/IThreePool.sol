pragma solidity 0.5.11;

interface IThreePool {
    function add_liquidity(uint256[3] calldata amounts, uint256 min) external;
    function remove_liquidity_one_coin(uint256 _token_amount, int128 i, uint256 min_amount) external;
    function calc_withdraw_one_coin(uint256 _token_amount, int128 i) external view returns(uint256);
}