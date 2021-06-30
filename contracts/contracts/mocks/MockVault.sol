pragma solidity 0.5.11;

import { VaultCore } from "../vault/VaultCore.sol";
import { VaultInitializer } from "../vault/VaultInitializer.sol";
import "../utils/Helpers.sol";

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

    function _checkBalance(address _asset)
        internal
        view
        returns (uint256 balance)
    {
        // Avoids rounding errors by returning the total value
        // in a single currency
        if (allAssets[0] == _asset) {
            uint256 decimals = Helpers.getDecimals(_asset);
            return storedTotalValue.scaleBy(int8(decimals - 18));
        } else {
            return 0;
        }
    }

    function setMaxSupplyDiff(uint256 _maxSupplyDiff) external onlyGovernor {
        maxSupplyDiff = _maxSupplyDiff;
    }
}
