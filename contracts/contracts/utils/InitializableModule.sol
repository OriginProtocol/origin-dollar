pragma solidity 0.5.17;

import {InitializableModuleKeys} from "./InitializableModuleKeys.sol";
import {IKernel} from "../interfaces/IKernel.sol";

contract InitializableModule is InitializableModuleKeys {
    IKernel public kernel;

    /**
     * @dev Modifier to allow function calls only from the Governor.
     */
    modifier onlyGovernor() {
        require(msg.sender == _governor(), "Only Governor can execute");
        _;
    }

    /**
     * @dev Modifier to allow function calls only from the ProxyAdmin.
     */
    modifier onlyProxyAdmin() {
        require(msg.sender == _proxyAdmin(), "Only ProxyAdmin can execute");
        _;
    }

    /**
     * @dev Initialization function for upgradable proxy contracts
     * @param _kernel Kernel contract address
     */
    function _initialize(address _kernel) internal {
        require(_kernel != address(0), "Kernel address is zero");
        kernel = IKernel(_kernel);
        InitializableModuleKeys._initialize();
    }

    /**
     * @dev Returns Governor address from the Kernel
     * @return Address of Governor Contract
     */
    function _governor() internal view returns (address) {
        return kernel.governor();
    }

    /**
     * @dev Return ProxyAdmin Module address from the Kernel
     * @return Address of the ProxyAdmin Module contract
     */
    function _proxyAdmin() internal view returns (address) {
        return kernel.getModule(KEY_PROXY_ADMIN);
    }

    /**
     * @dev Return PriceProvider address from the Kernel
     * @return Address of the PriceProvider Module contract
     */
    function _priceProvider() internal view returns (address) {
        return kernel.getModule(KEY_PRICE_ORACLE);
    }
}
