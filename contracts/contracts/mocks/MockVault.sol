// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { VaultAdmin } from "../vault/VaultAdmin.sol";
import { StableMath } from "../utils/StableMath.sol";
import "../utils/Helpers.sol";

contract MockVault is VaultAdmin {
    using StableMath for uint256;

    uint256 storedTotalValue;

    constructor(address _asset) VaultAdmin(_asset) {}

    function setTotalValue(uint256 _value) public {
        storedTotalValue = _value;
    }

    function totalValue() external view override returns (uint256) {
        return storedTotalValue;
    }

    function _totalValue() internal view override returns (uint256) {
        return storedTotalValue;
    }

    function _checkBalance(address _asset)
        internal
        view
        override
        returns (uint256 balance)
    {
        // Avoids rounding errors by returning the total value
        // in a single currency
        if (asset == _asset) {
            uint256 decimals = Helpers.getDecimals(_asset);
            return storedTotalValue.scaleBy(decimals, 18);
        } else {
            return 0;
        }
    }
}
