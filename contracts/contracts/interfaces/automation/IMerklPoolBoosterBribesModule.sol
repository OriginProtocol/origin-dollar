// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IAbstractSafeModule} from "contracts/interfaces/automation/IAbstractSafeModule.sol";

interface IMerklPoolBoosterBribesModule is IAbstractSafeModule {
    event FactoryUpdated(address newFactory);

    function factory() external view returns (address);

    function setFactory(address newFactory) external;

    function bribeAll(address[] calldata exclusionList) external;
}
