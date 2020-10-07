pragma solidity 0.5.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { ICurvePool } from "../../strategies/ICurvePool.sol";

contract MockCurvePool is ICurvePool, ERC20 {
    address[] coins;
    address lpToken;

    constructor(address[] _coins, address _lpToken) public {
        coins = _coins;
        lpToken = _lpToken;
    }

    function add_liquidity(uint256[] calldata _amounts, uint256 _minAmount) {
        return;
    }

    function calc_token_amount(uint256[] calldata _amounts, bool _deposit) {
        return;
    }

    function remove_liquidity_one_coin(
        uint256 _amount,
        int128 _index,
        uint256 _minAmount
    ) {
        return;
    }
}
