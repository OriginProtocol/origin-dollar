// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { BaseBuyback } from "./BaseBuyback.sol";

contract OETHBuyback is BaseBuyback {
    constructor(
        address _oToken,
        address _ogn,
        address _cvx,
        address _cvxLocker
    ) BaseBuyback(_oToken, _ogn, _cvx, _cvxLocker) {}
}
