// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IPoolBooster} from "contracts/interfaces/poolBooster/IPoolBooster.sol";

interface IPoolBoosterSwapxSingle is IPoolBooster {
    function bribeContract() external view returns (address);

    function osToken() external view returns (address);

    function MIN_BRIBE_AMOUNT() external view returns (uint256);
}
