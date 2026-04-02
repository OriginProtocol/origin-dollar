// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IPoolBooster } from "contracts/interfaces/poolBooster/IPoolBooster.sol";

interface IPoolBoosterMetropolis is IPoolBooster {
    function osToken() external view returns (address);

    function voter() external view returns (address);

    function pool() external view returns (address);

    function rewardFactory() external view returns (address);

    function MIN_BRIBE_AMOUNT() external view returns (uint256);
}
