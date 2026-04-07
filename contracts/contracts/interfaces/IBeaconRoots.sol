// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IBeaconRoots {
    function setBeaconRoot(uint256 timestamp, bytes32 root) external;

    function setBeaconRoot(bytes32 root) external;
}
