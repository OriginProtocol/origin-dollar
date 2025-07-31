// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IBribe } from "../interfaces/poolBooster/ISwapXAlgebraBribe.sol";
import { IPoolBooster } from "../interfaces/poolBooster/IPoolBooster.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Pool booster for SwapX for Classic Stable Pools and Classic Volatile Pools
 * @author Origin Protocol Inc
 */
contract PoolBoosterSwapxSingle is IPoolBooster {
    // @notice address of the Bribes.sol(Bribe) contract
    IBribe public immutable bribeContract;
    // @notice address of the OS token
    IERC20 public immutable osToken;
    // @notice if balance under this amount the bribe action is skipped
    uint256 public constant MIN_BRIBE_AMOUNT = 1e10;

    constructor(address _bribeContract, address _osToken) {
        require(_bribeContract != address(0), "Invalid bribeContract address");
        bribeContract = IBribe(_bribeContract);
        // Abstract factory already validates this is not a zero address
        osToken = IERC20(_osToken);
    }

    function bribe() external override {
        uint256 balance = osToken.balanceOf(address(this));
        // balance too small, do no bribes
        if (balance < MIN_BRIBE_AMOUNT) {
            return;
        }

        osToken.approve(address(bribeContract), balance);

        bribeContract.notifyRewardAmount(address(osToken), balance);
        emit BribeExecuted(balance);
    }
}
