// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IAbstractPoolBoosterFactory} from "contracts/interfaces/poolBooster/IAbstractPoolBoosterFactory.sol";

interface IPoolBoosterFactorySwapxDouble is IAbstractPoolBoosterFactory {
    function version() external pure returns (uint256);

    function createPoolBoosterSwapxDouble(
        address _bribeAddressOS,
        address _bribeAddressOther,
        address _ammPoolAddress,
        uint256 _split,
        uint256 _salt
    ) external;

    function computePoolBoosterAddress(
        address _bribeAddressOS,
        address _bribeAddressOther,
        address _ammPoolAddress,
        uint256 _split,
        uint256 _salt
    ) external view returns (address);
}
