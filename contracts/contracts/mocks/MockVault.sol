pragma solidity 0.5.11;

import { VaultCore } from "../vault/VaultCore.sol";
import { VaultInitializer } from "../vault/VaultInitializer.sol";

contract MockVault is VaultCore, VaultInitializer {
    uint256 storedTotalValue;

    function setTotalValue(uint256 _totalValue) public {
        storedTotalValue = _totalValue;
    }

    function totalValue() external view returns (uint256) {
        return storedTotalValue;
    }

    function _totalValue() internal view returns (uint256) {
        return storedTotalValue;
    }

    function setMaxSupplyDiff(uint256 _maxSupplyDiff) external onlyGovernor {
        maxSupplyDiff = _maxSupplyDiff;
    }
}
