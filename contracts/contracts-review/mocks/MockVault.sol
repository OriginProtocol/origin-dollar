pragma solidity 0.5.11;

import { Vault } from "../vault/Vault.sol";

contract MockVault is Vault {
    uint256 storedTotalValue;

    function setTotalValue(uint256 _totalValue) public {
        storedTotalValue = _totalValue;
    }

    function totalValue() public returns (uint256) {
        return storedTotalValue;
    }

    function _totalValue() internal returns (uint256) {
        return storedTotalValue;
    }
}
