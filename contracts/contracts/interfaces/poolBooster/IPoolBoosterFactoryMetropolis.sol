// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IAbstractPoolBoosterFactory } from "contracts/interfaces/poolBooster/IAbstractPoolBoosterFactory.sol";

interface IPoolBoosterFactoryMetropolis is IAbstractPoolBoosterFactory {
    function version() external pure returns (uint256);

    function rewardFactory() external view returns (address);

    function voter() external view returns (address);

    function createPoolBoosterMetropolis(address _ammPoolAddress, uint256 _salt)
        external;

    function computePoolBoosterAddress(address _ammPoolAddress, uint256 _salt)
        external
        view
        returns (address);
}
