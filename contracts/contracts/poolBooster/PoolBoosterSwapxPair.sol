// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IBribe } from "../interfaces/poolBooster/ISwapXAlgebraBribe.sol";
import { IPoolBooster } from "../interfaces/poolBooster/IPoolBooster.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { StableMath } from "../utils/StableMath.sol";

/**
 * @title Pool booster for SwapX for Classic Stable Pools and Classic Volatile Pools
 * @author Origin Protocol Inc
 */
contract PoolBoosterSwapxPair is IPoolBooster {
    using StableMath for uint256;

    // @notice address of the Bribes.sol(Bribe) contract
    IBribe public immutable bribeContract;
    // @notice address of the OS token
    IERC20 public immutable osToken;

    constructor(address _bribeContract, address _osToken) {
        bribeContract = IBribe(_bribeContract);
        osToken = IERC20(_osToken);
    }

    function bribe() external override {
        uint256 balance = osToken.balanceOf(address(this));
        osToken.approve(address(bribeContract), balance);

        bribeContract.notifyRewardAmount(address(osToken), balance);
        emit BribeExecuted(balance);
    }
}
