pragma solidity 0.5.11;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IMintableERC20 } from "../MintableERC20.sol";
import { ICurvePool } from "../../strategies/ICurvePool.sol";

contract MockCurvePool is ICurvePool, ERC20 {
    address[] public coins;
    address lpToken;

    constructor(address[] memory _coins, address _lpToken) public {
        coins = _coins;
        lpToken = _lpToken;
    }

    function add_liquidity(uint256[] calldata _amounts, uint256 _minAmount)
        external
    {
        uint256 sum = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            if (_amounts[i] > 0) {
                IERC20(coins[i]).transferFrom(
                    msg.sender,
                    address(this),
                    _amounts[i]
                );
                sum += _amounts[i];
            }
        }
        // Send LP token to sender, e.g. 3CRV
        IMintableERC20(lpToken).mint(sum);
        IERC20(lpToken).transfer(msg.sender, sum);
    }

    // Dumb implementation that returns half of the amounts
    function calc_token_amount(uint256[] memory _amounts, bool _deposit)
        public
        returns (uint256)
    {
        uint256 sum = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            sum += _amounts[i];
        }
        return sum / 2;
    }

    function remove_liquidity_one_coin(
        uint256 _amount,
        int128 _index,
        uint256 _minAmount
    ) external {
        IERC20(lpToken).transferFrom(msg.sender, address(0), _amount);
        uint256[] memory amounts = new uint256[](coins.length);
        amounts[uint256(_index)] = _amount;
        uint256 amount = calc_token_amount(amounts, false);
        IERC20(coins[uint256(_index)]).transfer(msg.sender, amount);
    }
}
