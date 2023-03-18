// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IVaultValueChecker {
    function takeSnapshot() external;

    function checkDelta(
        int256 lowValueDelta,
        int256 highValueDelta,
        int256 lowSupplyDelta,
        int256 highSupplyDelta
    ) external;
}
