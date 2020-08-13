pragma solidity 0.5.17;

contract InitializableKeys {

    bytes32 internal KEY_GOVERNANCE;
    bytes32 internal KEY_PROXY_ADMIN;
    bytes32 internal KEY_VAULT;

    /**
     * @dev Initialize function for upgradable proxy contracts. This function should be called
     *      via Proxy to initialize constants in the Proxy contract.
     */
    function _initialize() internal {
        KEY_PROXY_ADMIN = keccak256("ProxyAdmin");
        KEY_VAULT = keccak256("Vault");
    }
}
