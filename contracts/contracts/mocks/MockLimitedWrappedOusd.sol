// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { WrappedOusd } from "../token/WrappedOusd.sol";

contract MockLimitedWrappedOusd is WrappedOusd {
    constructor(address underlying_, address vault_)
        WrappedOusd(underlying_, vault_)
    {}

    function maxDeposit(address)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return 1e18;
    }
}
