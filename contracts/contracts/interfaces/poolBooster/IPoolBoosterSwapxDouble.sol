// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IPoolBooster} from "contracts/interfaces/poolBooster/IPoolBooster.sol";

interface IPoolBoosterSwapxDouble is IPoolBooster {
    function bribeContractOS() external view returns (address);

    function bribeContractOther() external view returns (address);

    function osToken() external view returns (address);

    function split() external view returns (uint256);

    function MIN_BRIBE_AMOUNT() external view returns (uint256);
}
