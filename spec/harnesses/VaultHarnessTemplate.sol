pragma solidity 0.5.11;
import "contracts/vault/Vault.sol";
import "contracts/utils/InitializableAbstractStrategy.sol";
import "contracts/interfaces/IStrategy.sol";

contract VaultHarness is VAULT_BASE {
    function Certora_isSupportedStrategy(address a) external view returns (bool) { return strategies[a].isSupported; }
    function Certora_isSupportedAsset(address _asset) external view returns (bool) { return assets[_asset].isSupported; }
    function Certora_getStrategyCount() external view returns (uint256) { return allStrategies.length; }
    function Certora_getAssetCount() public view returns (uint256) { return allAssets.length; }

    function Certora_vaultOfStrategy(address strategy) external returns (address) {
        return InitializableAbstractStrategy(strategy).vaultAddress();
    }

    function Certora_isStrategySupportingAsset(address strategy, address asset) external returns (bool) {
        return IStrategy(strategy).supportsAsset(asset);
    }

    function init_state() external {}
}