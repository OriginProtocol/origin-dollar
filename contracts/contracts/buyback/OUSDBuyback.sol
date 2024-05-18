// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { AbstractBuyback } from "./AbstractBuyback.sol";

contract OUSDBuyback is AbstractBuyback {
    constructor(
        address _oToken,
        address _ogn,
        address _cvx,
        address _cvxLocker
    ) AbstractBuyback(_oToken, _ogn, _cvx, _cvxLocker) {}
}
