// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface ICreateX {
    struct Values {
        uint256 constructorAmount;
        uint256 initCallAmount;
    }

    error FailedContractCreation(address emitter);
    error FailedContractInitialisation(address emitter, bytes revertData);
    error FailedEtherTransfer(address emitter, bytes revertData);
    error InvalidNonceValue(address emitter);
    error InvalidSalt(address emitter);

    event ContractCreation(address indexed newContract, bytes32 indexed salt);
    event ContractCreation(address indexed newContract);
    event Create3ProxyContractCreation(
        address indexed newContract,
        bytes32 indexed salt
    );

    function computeCreate2Address(bytes32 salt, bytes32 initCodeHash)
        external
        view
        returns (address computedAddress);

    function computeCreate2Address(
        bytes32 salt,
        bytes32 initCodeHash,
        address deployer
    ) external pure returns (address computedAddress);

    function computeCreate3Address(bytes32 salt, address deployer)
        external
        pure
        returns (address computedAddress);

    function computeCreate3Address(bytes32 salt)
        external
        view
        returns (address computedAddress);

    function computeCreateAddress(uint256 nonce)
        external
        view
        returns (address computedAddress);

    function computeCreateAddress(address deployer, uint256 nonce)
        external
        view
        returns (address computedAddress);

    function deployCreate(bytes memory initCode)
        external
        payable
        returns (address newContract);

    function deployCreate2(bytes32 salt, bytes memory initCode)
        external
        payable
        returns (address newContract);

    function deployCreate2(bytes memory initCode)
        external
        payable
        returns (address newContract);

    function deployCreate2AndInit(
        bytes32 salt,
        bytes memory initCode,
        bytes memory data,
        Values memory values,
        address refundAddress
    ) external payable returns (address newContract);

    function deployCreate2AndInit(
        bytes memory initCode,
        bytes memory data,
        Values memory values
    ) external payable returns (address newContract);

    function deployCreate2AndInit(
        bytes memory initCode,
        bytes memory data,
        Values memory values,
        address refundAddress
    ) external payable returns (address newContract);

    function deployCreate2AndInit(
        bytes32 salt,
        bytes memory initCode,
        bytes memory data,
        Values memory values
    ) external payable returns (address newContract);

    function deployCreate2Clone(
        bytes32 salt,
        address implementation,
        bytes memory data
    ) external payable returns (address proxy);

    function deployCreate2Clone(address implementation, bytes memory data)
        external
        payable
        returns (address proxy);

    function deployCreate3(bytes memory initCode)
        external
        payable
        returns (address newContract);

    function deployCreate3(bytes32 salt, bytes memory initCode)
        external
        payable
        returns (address newContract);

    function deployCreate3AndInit(
        bytes32 salt,
        bytes memory initCode,
        bytes memory data,
        Values memory values
    ) external payable returns (address newContract);

    function deployCreate3AndInit(
        bytes memory initCode,
        bytes memory data,
        Values memory values
    ) external payable returns (address newContract);

    function deployCreate3AndInit(
        bytes32 salt,
        bytes memory initCode,
        bytes memory data,
        Values memory values,
        address refundAddress
    ) external payable returns (address newContract);

    function deployCreate3AndInit(
        bytes memory initCode,
        bytes memory data,
        Values memory values,
        address refundAddress
    ) external payable returns (address newContract);

    function deployCreateAndInit(
        bytes memory initCode,
        bytes memory data,
        Values memory values
    ) external payable returns (address newContract);

    function deployCreateAndInit(
        bytes memory initCode,
        bytes memory data,
        Values memory values,
        address refundAddress
    ) external payable returns (address newContract);

    function deployCreateClone(address implementation, bytes memory data)
        external
        payable
        returns (address proxy);
}
