// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IRateProvider } from "./IRateProvider.sol";

interface IMetaStablePool {
    function getRateProviders()
        external
        view
        returns (IRateProvider[] memory providers);
}
