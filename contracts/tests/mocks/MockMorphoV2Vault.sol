// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {MockERC4626Vault} from "contracts/mocks/MockERC4626Vault.sol";

/**
 * @title MockMorphoV2Vault
 * @notice Mock that extends MockERC4626Vault with a configurable liquidityAdapter.
 */
contract MockMorphoV2Vault is MockERC4626Vault {
    address private _liquidityAdapter;

    constructor(address _asset, address liquidityAdapter_) MockERC4626Vault(_asset) {
        _liquidityAdapter = liquidityAdapter_;
    }

    function liquidityAdapter() external view override returns (address) {
        return _liquidityAdapter;
    }
}
