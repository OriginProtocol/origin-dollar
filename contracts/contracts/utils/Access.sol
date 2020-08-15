pragma solidity 0.5.17;

import {InitializableModuleKeys} from "../utils/InitializableModuleKeys.sol";
import {IKernel} from "../interfaces/IKernel.sol";

contract Access is InitializableModuleKeys {
    IKernel public kernel;

    /**
     * @dev Initialises the Access by setting publisher addresses,
     *      and reading all available system access information
     */
    constructor(address _kernel) internal {
        require(_kernel != address(0), "Kernel is zero address");
        kernel = IKernel(_kernel);
        InitializableModuleKeys._initialize();
    }

    /**
     * @dev Modifier to allow function calls only from the Governor.
     */
    modifier onlyGovernor() {
        require(msg.sender == _governor(), "Only governor can execute");
        _;
    }

    /**
     * @dev Modifier to allow function calls only from the Vault.
     */
    modifier onlyVault {
        require(msg.sender == _vault(), "Only vault can execute");
        _;
    }

    /**
     * @dev Returns Governor address from the Kernel
     * @return Address of Governor Contract
     */
    function _governor() internal view returns (address) {
        return kernel.governor();
    }

    /**
     * @dev Return Staking Access address from the Kernel
     * @return Address of the Staking Access contract
     */
    function _vault() internal view returns (address) {
        return kernel.getModule(KEY_VAULT);
    }

    /**
     * @dev Return ProxyAdmin Access address from the Kernel
     * @return Address of the ProxyAdmin Access contract
     */
    function _proxyAdmin() internal view returns (address) {
        return kernel.getModule(KEY_PROXY_ADMIN);
    }
}
