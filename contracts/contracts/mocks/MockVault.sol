pragma solidity 0.5.11;

import { Vault } from "../vault/Vault.sol";

contract MockVault is Vault {
    uint256 storedTotalValue;

    function setTotalValue(uint256 _totalValue) public {
        storedTotalValue = _totalValue;
    }

    function totalValue() external returns (uint256) {
        return storedTotalValue;
    }

    function totalValue(uint256[] calldata assetPrices)
        external
        view
        returns (uint256)
    {
        return storedTotalValue;
    }

    function _totalValue(uint256[] memory assetPrices)
        internal
        view
        returns (uint256)
    {
        return storedTotalValue;
    }
}
