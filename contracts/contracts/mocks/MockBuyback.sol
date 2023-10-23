// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { BaseBuyback } from "../buyback/BaseBuyback.sol";

contract MockBuyback is BaseBuyback {
    constructor(
        address _oToken,
        address _ogv,
        address _cvx,
        address _cvxLocker
    ) BaseBuyback(_oToken, _ogv, _cvx, _cvxLocker) {}

    function _getSwapPath(address toToken)
        internal
        view
        override
        returns (bytes memory path)
    {
        return abi.encodePacked(oToken, uint24(500), toToken);
    }
}
