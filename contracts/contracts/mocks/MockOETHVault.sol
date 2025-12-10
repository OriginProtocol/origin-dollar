// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OETHVaultCore } from "../vault/OETHVaultCore.sol";
import { StableMath } from "../utils/StableMath.sol";
import "../utils/Helpers.sol";

contract MockOETHVault is OETHVaultCore {
    using StableMath for uint256;

    constructor(address _weth) OETHVaultCore(_weth) {
        _setGovernor(msg.sender);
    }

    function supportAsset(address asset) external {
        require(asset == backingAsset, "Only backingAsset supported");
    }
}
