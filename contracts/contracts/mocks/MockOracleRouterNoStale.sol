// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { Helpers } from "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { OracleRouter, OETHOracleRouter } from "../oracle/OracleRouter.sol";

// @notice Oracle Router used to bypass staleness
contract MockOracleRouterNoStale is OracleRouter {
    function feedMetadata(address asset)
        internal
        pure
        virtual
        override
        returns (
            address feedAddress,
            uint256 maxStaleness,
            uint256 decimals
        )
    {
        (feedAddress, , decimals) = super.feedMetadata(asset);
        maxStaleness = 365 days;
    }
}

// @notice Oracle Router used to bypass staleness
contract MockOETHOracleRouterNoStale is OETHOracleRouter {
    function feedMetadata(address asset)
        internal
        pure
        virtual
        override
        returns (
            address feedAddress,
            uint256 maxStaleness,
            uint256 decimals
        )
    {
        (feedAddress, , decimals) = super.feedMetadata(asset);
        maxStaleness = 365 days;
    }
}
