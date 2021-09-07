pragma solidity ^0.8.0;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @notice OUSDProxy delegates calls to an OUSD implementation
 */
abstract contract OUSDProxy is ERC1967Proxy {

}

/**
 * @notice VaultProxy delegates calls to a Vault implementation
 */
abstract contract VaultProxy is ERC1967Proxy {

}

/**
 * @notice CompoundStrategyProxy delegates calls to a CompoundStrategy implementation
 */
abstract contract CompoundStrategyProxy is ERC1967Proxy {

}

/**
 * @notice ThreePoolStrategyProxy delegates calls to a ThreePoolStrategy implementation
 */
abstract contract ThreePoolStrategyProxy is ERC1967Proxy {

}
