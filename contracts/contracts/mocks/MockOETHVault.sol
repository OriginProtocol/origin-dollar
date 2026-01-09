// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OETHVaultAdmin } from "../vault/OETHVaultAdmin.sol";
import { StableMath } from "../utils/StableMath.sol";
import "../utils/Helpers.sol";

contract MockOETHVault is OETHVaultAdmin {
    using StableMath for uint256;

    constructor(address _weth) OETHVaultAdmin(_weth) {
        _setGovernor(msg.sender);
    }

    function supportAsset(address asset) external {
        require(asset == asset, "Only asset supported");
    }
}
