// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IAbstractPoolBoosterFactory } from "contracts/interfaces/poolBooster/IAbstractPoolBoosterFactory.sol";

interface IPoolBoosterFactoryMerkl is IAbstractPoolBoosterFactory {
    function version() external pure returns (string memory);

    function beacon() external view returns (address);

    function createPoolBoosterMerkl(
        address _ammPoolAddress,
        bytes calldata _initData,
        uint256 _salt
    ) external;

    function computePoolBoosterAddress(uint256 _salt, bytes calldata _initData)
        external
        view
        returns (address);

    function removePoolBoosterByIndex(uint256 _index) external;
}
