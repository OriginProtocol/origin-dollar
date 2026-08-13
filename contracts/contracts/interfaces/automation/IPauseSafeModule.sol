// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IAbstractSafeModule } from "contracts/interfaces/automation/IAbstractSafeModule.sol";

interface IPauseSafeModule is IAbstractSafeModule {
    event TargetAllowed(address indexed target);
    event TargetRevoked(address indexed target);
    event CapitalPauseExecuted(address indexed target);
    event RebasePauseExecuted(address indexed target);

    function isPausableTarget(address target) external view returns (bool);

    function pauseCapital(address _target) external;

    function pauseRebase(address _target) external;

    function allowTarget(address _target) external;

    function revokeTarget(address _target) external;
}
