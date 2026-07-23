// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title MockMorphoV2Adapter
 * @notice Mock that implements IMorphoV2Adapter interface for unit testing.
 */
contract MockMorphoV2Adapter {
    address public morphoVaultV1;
    address public parentVault;

    constructor(address _morphoVaultV1, address _parentVault) {
        morphoVaultV1 = _morphoVaultV1;
        parentVault = _parentVault;
    }
}
