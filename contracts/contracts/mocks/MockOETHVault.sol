// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OETHVault } from "../vault/OETHVault.sol";
import { StableMath } from "../utils/StableMath.sol";
import "../utils/Helpers.sol";

contract MockOETHVault is OETHVault {
    using StableMath for uint256;

    constructor(address _weth) OETHVault(_weth) {
        _setGovernor(msg.sender);
    }

    function supportAsset(address asset) external {
        require(asset == asset, "Only asset supported");
    }
}
