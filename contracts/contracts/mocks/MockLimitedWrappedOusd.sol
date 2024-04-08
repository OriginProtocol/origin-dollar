// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { WrappedOusd } from "../token/WrappedOusd.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockLimitedWrappedOusd is WrappedOusd {
    constructor(
        ERC20 underlying_,
        string memory name_,
        string memory symbol_
    ) WrappedOusd(underlying_, name_, symbol_) {}

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
