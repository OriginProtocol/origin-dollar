// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IAbstractPoolBoosterFactory } from "contracts/interfaces/poolBooster/IAbstractPoolBoosterFactory.sol";

interface IPoolBoosterFactorySwapxSingle is IAbstractPoolBoosterFactory {
    function version() external pure returns (uint256);

    function createPoolBoosterSwapxSingle(
        address _bribeAddress,
        address _ammPoolAddress,
        uint256 _salt
    ) external;

    function computePoolBoosterAddress(
        address _bribeAddress,
        address _ammPoolAddress,
        uint256 _salt
    ) external view returns (address);
}
