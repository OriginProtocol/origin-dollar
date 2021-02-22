pragma solidity 0.5.11;
import "../../contracts/contracts/vault/Vault.sol";
import "../../contracts/contracts/vault/VaultCore.sol";
import "../../contracts/contracts/utils/InitializableAbstractStrategy.sol";
import "../../contracts/contracts/interfaces/IStrategy.sol";

// VaultCore is harnessed to inherit Vault (which inherits from VaultAdmin) and ignore the eth specific limitations on contract size.
contract VaultHarness is VaultCore {
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