// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IAbstractSafeModule } from "./IAbstractSafeModule.sol";

interface ICurveAmoRepegModule is IAbstractSafeModule {
    event Repegged(
        uint256 indexed nonce,
        uint256 lpTokens,
        int256 expectedProfit,
        int256 profitVariance,
        int256 expectedVaultChange,
        int256 vaultChangeVariance
    );

    function vault() external view returns (address);

    function amo() external view returns (address);

    function checker() external view returns (address);

    function maxProfitVariance() external view returns (uint256);

    function maxVaultChangeVariance() external view returns (uint256);

    function nonce() external view returns (uint256);

    function repeg(
        uint256 lpTokens,
        int256 expectedProfit,
        int256 profitVariance,
        int256 expectedVaultChange,
        int256 vaultChangeVariance,
        uint256 expectedNonce,
        uint256 deadline
    ) external;
}
