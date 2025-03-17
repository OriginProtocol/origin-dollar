// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { MorphoAaveStrategy } from "./MorphoAaveStrategy.sol";

contract TempMorphoAaveStrategy is MorphoAaveStrategy {
    constructor(BaseStrategyConfig memory _stratConfig)
        MorphoAaveStrategy(_stratConfig)
    {}

    function _checkBalance(address _asset)
        internal
        view
        virtual
        override
        returns (uint256 balance)
    {
        balance = super._checkBalance(_asset);

        if (
            _asset == 0x6B175474E89094C44Da98b954EedeAC495271d0F &&
            balance <= 20 ether
        ) {
            return 0;
        }

        return balance;
    }
}
