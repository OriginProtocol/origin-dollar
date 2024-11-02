// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IDirectStakingCaller } from "../interfaces/IDirectStakingCaller.sol";
import { IDirectStakingHandler } from "../interfaces/IDirectStakingHandler.sol";

import { BridgedWOETH } from "../token/BridgedWOETH.sol";
import { MintableERC20 } from "../mocks/MintableERC20.sol";

contract MockDirectStakingHandler is IDirectStakingHandler {
    BridgedWOETH public immutable woeth;
    MintableERC20 public immutable weth;

    uint256 public nextMinOut;
    address public lastCaller;

    constructor(address _woeth, address _weth) {
        woeth = BridgedWOETH(_woeth);
        weth = MintableERC20(_weth);
    }

    function stake(
        uint256 wethAmount,
        uint256 minAmountOut,
        bool
    ) external payable override returns (bytes32) {
        weth.transferFrom(msg.sender, address(this), wethAmount);

        nextMinOut = minAmountOut;
        lastCaller = msg.sender;

        // Just return an empty amount
        return bytes32(hex"deadfeed");
    }

    function mockInvokeCallback() external {
        woeth.mint(lastCaller, nextMinOut);
        IDirectStakingCaller(lastCaller).onDirectStakingRequestCompletion(
            hex"deadfeed",
            nextMinOut
        );
    }

    function setNextMinOut(uint256 amount) external {
        nextMinOut = amount;
    }
}
