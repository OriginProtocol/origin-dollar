// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Interfaces
import { ICreateX } from "../interfaces/ICreateX.sol";

// Contracts
import { Governable } from "../governance/Governable.sol";
import { CurvePoolBoosterProxy } from "../proxies/Proxies.sol";
import { ERC20Rescue } from "../utils/ERC20Rescue.sol";

/// @title PoolBoosterFactoryCurveMainnetL2Helper
/// @author Origin Protocol
/// @notice This contract is a Factory to deploy ERC20Rescue contract at a specific address on L2.
contract PoolBoosterFactoryCurveMainnetL2Helper is Governable {
    uint256 public constant version = 1;

    ICreateX public constant createX =
        ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);

    event ERC20RescueDeployed(address indexed rescueAddress);

    constructor(address _governor) {
        _setGovernor(_governor);
    }

    /// @notice Deploy ERC20Rescue contract at a specific address on L2.
    /// @param _salt This is a random bytes11 salt to make the address unique, it should be
    ///        the same as the one used on mainnet. To be sure that the address will match
    ///        the one on mainnet, `computeSalt` function can be used.
    /// @param _strategist Address of the strategist
    function createERC20Rescue(bytes11 _salt, address _strategist)
        external
        onlyGovernor
    {
        // --- Salts ---
        bytes1 crosschainProtectionFlag = hex"00"; // Need to be 0, otherwise cross-chain is blocked.
        // deployer address || crossChainProtectionFlag || bytes11(randomness)
        bytes32 encodedSalt = bytes32(
            abi.encodePacked(address(this), crosschainProtectionFlag, _salt)
        );

        // --- Bytecodes ---
        // Impl
        bytes memory bytecodeImpl = abi.encodePacked(
            type(ERC20Rescue).creationCode
        );
        // Proxy
        bytes memory bytecodeProxy = abi.encodePacked(
            type(CurvePoolBoosterProxy).creationCode
        );

        // --- Deploy ---
        // Deploy Implementation
        address impl = createX.deployCreate3(encodedSalt, bytecodeImpl);
        // Deploy and Init Proxy
        address addr = createX.deployCreate3AndInit(
            encodedSalt,
            bytecodeProxy,
            abi.encodeWithSignature(
                "initialize(address,address,bytes)",
                impl,
                governor(),
                abi.encodeWithSelector(
                    ERC20Rescue.initialize.selector,
                    _strategist
                )
            ),
            ICreateX.Values(0, 0)
        );

        emit ERC20RescueDeployed(addr);
    }

    /// @notice Compute the address of the ERC20Rescue contract that will be deployed
    ///         with the given salt.
    /// @param _salt This is a random bytes11 salt to make the address unique, it should be
    ///        the same as the one used on mainnet. To be sure that the address will match
    ///        the one on mainnet, `computeSalt` function can be used.
    /// @return The address of the ERC20Rescue contract that will be deployed with the given salt.
    function computePoolBoosterAddress(bytes11 _salt)
        external
        view
        returns (address)
    {
        bytes1 crosschainProtectionFlag = hex"00"; // Need to be 0, otherwise cross-chain is blocked.
        bytes32 encodedSalt = bytes32(
            abi.encodePacked(address(this), crosschainProtectionFlag, _salt)
        );

        return
            createX.computeCreate2Address(
                encodedSalt,
                keccak256(
                    abi.encodePacked(type(CurvePoolBoosterProxy).creationCode)
                )
            );
    }

    /// @notice Compute the salt that will be used to deploy the ERC20Rescue contract.
    /// @param _oToken Address of the oToken
    /// @param _targetChainId Target chain id
    /// @param _curveGauge Address of the curve gauge
    /// @param _entropySalt Random bytes11 salt
    /// @return The salt that will be used to deploy the ERC20Rescue contract.
    function computeSalt(
        address _oToken,
        uint256 _targetChainId,
        address _curveGauge,
        bytes11 _entropySalt
    ) external pure returns (bytes11) {
        return
            bytes11(
                keccak256(
                    abi.encodePacked(
                        _oToken,
                        _targetChainId,
                        _curveGauge,
                        _entropySalt
                    )
                )
            );
    }
}
