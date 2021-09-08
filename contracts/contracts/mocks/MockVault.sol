pragma solidity ^0.8.0;

import { StableMath } from "../utils/StableMath.sol";
import { VaultInitializer } from "../vault/VaultInitializer.sol";
import "../utils/Helpers.sol";

contract MockVault is VaultInitializer {
    using StableMath for uint256;
    uint256 storedTotalValue;

    function setTotalValue(uint256 _value) public {
        storedTotalValue = _value;
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
            return storedTotalValue.scaleBy(decimals, 18);
        } else {
            return 0;
        }
    }

    function setMaxSupplyDiff(uint256 _maxSupplyDiff) external onlyGovernor {
        maxSupplyDiff = _maxSupplyDiff;
    }
}
