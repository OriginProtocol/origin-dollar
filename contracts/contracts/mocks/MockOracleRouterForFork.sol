// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { Helpers } from "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { OracleRouter, OETHOracleRouter } from "../oracle/OracleRouter.sol";

// @notice Oracle Router used to bypass staleness
contract MockOracleRouterForFork is OracleRouter {
    function feedMetadata(address asset)
        internal
        pure
        virtual
        override
        returns (address feedAddress, uint256 maxStaleness)
    {
        (feedAddress, ) = super.feedMetadata(asset);
        maxStaleness = 0;
    }
}

// @notice Oracle Router used to bypass staleness
contract MockOETHOracleRouterForFork is OETHOracleRouter {
    function feedMetadata(address asset)
        internal
        pure
        virtual
        override
        returns (address feedAddress, uint256 maxStaleness)
    {
        (feedAddress, ) = super.feedMetadata(asset);
        maxStaleness = 0;
    }
}
