pragma solidity 0.5.17;

/**
 * @title IKernel
 * @dev Basic interface for interacting with the Kernel
 */
interface IKernel {
    function governor() external view returns (address);

    function getModule(bytes32 key) external view returns (address);

    function proposeModule(bytes32 _key, address _addr) external;

    function cancelProposedModule(bytes32 _key) external;

    function acceptProposedModule(bytes32 _key) external;

    function acceptProposedModules(bytes32[] calldata _keys) external;
}
