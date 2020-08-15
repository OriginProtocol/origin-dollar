pragma solidity 0.5.17;

contract InitializableModuleKeys {
    bytes32 internal KEY_PROXY_ADMIN;
    bytes32 internal KEY_VAULT;
    bytes32 internal KEY_PRICE_ORACLE;

    /**
     * @dev Initialize function for upgradable proxy contracts. This function should be called
     *      via Proxy to initialize constants in the Proxy contract.
     */
    function _initialize() internal {
        KEY_PROXY_ADMIN = keccak256("ProxyAdmin");
        KEY_VAULT = keccak256("Vault");
        KEY_PRICE_ORACLE = keccak256("PriceOracle");
    }
}
