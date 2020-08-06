pragma solidity ^0.5.0;

import { IKernel } from "../interfaces/IKernel.sol";
import { Governable } from "../governance/Governable.sol";

contract Kernel is IKernel, Governable {

    event ModuleProposed(bytes32 indexed key, address addr, uint256 timestamp);
    event ModuleAdded(bytes32 indexed key, address addr);
    event ModuleCancelled(bytes32 indexed key);

    /** @dev Struct to store information about current modules */
    struct Module {
        address addr;       // Module address
    }

    /** @dev Struct to store information about proposed modules */
    struct Proposal {
        address newAddress; // Proposed Module address
        uint256 timestamp;  // Timestamp when module upgrade was proposed
    }

    // Module-key => Module
    mapping(bytes32 => Module) public modules;
    // Module-address => Module-key
    mapping(address => bytes32) private addressToModule;
    // Module-key => Proposal
    mapping(bytes32 => Proposal) public proposedModules;

    // Init flag to allow add modules at the time of deplyment without delay
    bool public initialized = false;

    /**
     * @dev Modifier allows functions calls only when contract is not initialized.
     */
    modifier whenNotInitialized() {
        require(!initialized, "Kernel is already initialized");
        _;
    }

    /**
     * @dev Adds multiple new modules to the system to initialize the
     *      Kernel contract with default modules. This should be called first
     *      after deploying Kernel contract.
     * @param _keys         Keys of the new modules in bytes32 form
     * @param _addresses    Contract addresses of the new modules
     * @return bool         Success of publishing new Modules
     */
    function initialize(
        bytes32[] calldata _keys,
        address[] calldata _addresses,
        address _governorAddr
    )
        external
        onlyGovernor
        whenNotInitialized
        returns (bool)
    {
        uint256 len = _keys.length;
        require(len > 0, "No keys provided");
        require(len == _addresses.length, "Insufficient address data");

        for(uint256 i = 0 ; i < len; i++) {
            _publishModule(_keys[i], _addresses[i]);
        }

        if(_governorAddr != governor()) _changeGovernor(_governorAddr);

        initialized = true;
        return true;
    }

    /**
     * @dev Propose a new or update existing module
     * @param _key  Key of the module
     * @param _addr Address of the module
     */
    function proposeModule(bytes32 _key, address _addr)
        external
        onlyGovernor
    {
        require(_key != bytes32(0x0), "Key must not be zero");
        require(_addr != address(0), "Module address must not be 0");
        require(modules[_key].addr != _addr, "Module already has same address");
        Proposal storage p = proposedModules[_key];
        require(p.timestamp == 0, "Module already proposed");

        p.newAddress = _addr;
        p.timestamp = now;
        emit ModuleProposed(_key, _addr, now);
    }

    /**
     * @dev Cancel a proposed module request
     * @param _key Key of the module
     */
    function cancelProposedModule(bytes32 _key)
        external
        onlyGovernor
    {
        uint256 timestamp = proposedModules[_key].timestamp;
        require(timestamp > 0, "Proposed module not found");

        delete proposedModules[_key];
        emit ModuleCancelled(_key);
    }

    /**
     * @dev Accept and publish an already proposed module
     * @param _key Key of the module
     */
    function acceptProposedModule(bytes32 _key)
        external
        onlyGovernor
    {
        _acceptProposedModule(_key);
    }

    /**
     * @dev Accept and publish already proposed modules
     * @param _keys Keys array of the modules
     */
    function acceptProposedModules(bytes32[] calldata _keys)
        external
        onlyGovernor
    {
        uint256 len = _keys.length;
        require(len > 0, "Keys array empty");

        for(uint256 i = 0 ; i < len; i++) {
            _acceptProposedModule(_keys[i]);
        }
    }

    /**
     * @dev Accept a proposed module
     * @param _key Key of the module
     */
    function _acceptProposedModule(bytes32 _key) internal {
        Proposal memory p = proposedModules[_key];

        delete proposedModules[_key];
        _publishModule(_key, p.newAddress, false);
    }

    /**
     * @dev Internal func to publish a module to kernel
     * @param _key      Key of the new module in bytes32 form
     * @param _addr     Contract address of the new module
     */
    function _publishModule(bytes32 _key, address _addr) internal {
        require(addressToModule[_addr] == bytes32(0x0), "Modules must have unique addr");
        // Old no longer points to a moduleAddress
        address oldModuleAddr = modules[_key].addr;
        if(oldModuleAddr != address(0x0)) {
            addressToModule[oldModuleAddr] = bytes32(0x0);
        }
        modules[_key].addr = _addr;
        addressToModule[_addr] = _key;
        emit ModuleAdded(_key, _addr);
    }

    /**
     * @dev Checks if a module exists
     * @param _key  Key of the module
     * @return      Returns 'true' when a module exists, otherwise 'false'
     */
    function moduleExists(bytes32 _key) public view returns (bool) {
        if(_key != 0 && modules[_key].addr != address(0))
            return true;
        return false;
    }

    /**
     * @dev Get the module address
     * @param _key  Key of the module
     * @return      Return the address of the module
     */
    function getModule(bytes32 _key) external view returns (address addr) {
        addr = modules[_key].addr;
    }
}
