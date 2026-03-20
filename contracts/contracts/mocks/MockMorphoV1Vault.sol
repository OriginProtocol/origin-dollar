// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { MockERC4626Vault } from "./MockERC4626Vault.sol";

contract MockMorphoV1Vault is MockERC4626Vault {
    address public liquidityAdapter;

    constructor(address _asset) MockERC4626Vault(_asset) {}

    function setLiquidityAdapter(address _liquidityAdapter) external {
        liquidityAdapter = _liquidityAdapter;
    }
}
