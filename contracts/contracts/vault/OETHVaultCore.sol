// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { VaultCore } from "./VaultCore.sol";

/**
 * @title OETH VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OETHVaultCore is VaultCore {
    address public immutable weth;

    constructor(address _weth) {
        weth = _weth;
    }

    // @inheritdoc VaultCore
    function mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumOusdAmount
    ) external virtual override whenNotCapitalPaused nonReentrant {
        require(_asset == weth, "Unsupported asset for minting");
        _mint(_asset, _amount, _minimumOusdAmount);
    }
}
