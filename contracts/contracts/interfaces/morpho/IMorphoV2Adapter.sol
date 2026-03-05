// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IMorphoV2Adapter {
    // address of the underlying vault
    function morphoVaultV1() external view returns (address);

    // address of the parent Morpho V2 vault
    function parentVault() external view returns (address);
}
