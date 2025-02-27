// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Interfaces
import { ICreateX } from "../interfaces/ICreateX.sol";

// Contracts
import { CurvePoolBoosterProxy } from "../proxies/Proxies.sol";
import { PoolBoosterCurveMainnet } from "./PoolBoosterCurveMainnet.sol";
import { AbstractPoolBoosterFactory, IPoolBoostCentralRegistry } from "./AbstractPoolBoosterFactory.sol";

contract PoolBoosterFactoryCurveMainnet is AbstractPoolBoosterFactory {
    ICreateX public constant createX =
        ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);

    constructor(
        address _oToken,
        address _governor,
        address _centralRegistry
    ) AbstractPoolBoosterFactory(_oToken, _governor, _centralRegistry) {}

    function createPoolBoosterCurveMainnet(
        uint256 _targetChainId,
        address _curveGauge,
        address _strategist,
        uint16 _fee,
        address _feeCollector,
        address _campaignRemoteManager,
        address _votemarket,
        bytes32 _entropySalt
    ) external onlyGovernor {
        require(_curveGauge != address(0), "Invalid curve gauge address");
        require(_entropySalt != 0, "Invalid entropy salt");
        // --- Salts ---
        bytes1 crosschainProtectionFlag = hex"00"; // Need to be 0, otherwise cross-chain is blocked.
        bytes11 salt = bytes11(
            keccak256(
                abi.encodePacked(
                    oSonic,
                    _targetChainId,
                    _curveGauge,
                    _entropySalt
                )
            )
        );
        // deployer address || crossChainProtectionFlag || bytes11(randomness)
        bytes32 encodedSalt = bytes32(
            abi.encodePacked(address(this), crosschainProtectionFlag, salt)
        );

        // --- Bytecodes ---
        // Impl
        bytes memory bytecodeImpl = abi.encodePacked(
            type(PoolBoosterCurveMainnet).creationCode,
            abi.encode(_targetChainId, oSonic, _curveGauge)
        );
        // Proxy
        bytes memory bytecodeProxy = abi.encodePacked(
            type(CurvePoolBoosterProxy).creationCode
        );

        // Deploy Implementation
        createX.deployCreate2(encodedSalt, bytecodeImpl);
        // Deploy and Init Proxy
        address pb = createX.deployCreate2AndInit(
            encodedSalt,
            bytecodeProxy,
            abi.encodeWithSelector(
                PoolBoosterCurveMainnet.initialize.selector,
                _strategist,
                _fee,
                _feeCollector,
                _campaignRemoteManager,
                _votemarket
            ),
            ICreateX.Values(0, 0)
        );

        _storePoolBoosterEntry(
            pb,
            _curveGauge,
            IPoolBoostCentralRegistry.PoolBoosterType.CurveMainnetBooster
        );
    }

    function computePoolBoosterAddress(
        uint256 _targetChainId,
        address _curveGauge,
        bytes32 _entropySalt
    ) external view returns (address) {
        require(_curveGauge != address(0), "Invalid curve gauge address");
        require(_entropySalt != 0, "Invalid entropy salt");

        bytes1 crosschainProtectionFlag = hex"00"; // Need to be 0, otherwise cross-chain is blocked.
        bytes11 salt = bytes11(
            keccak256(
                abi.encodePacked(
                    oSonic,
                    _targetChainId,
                    _curveGauge,
                    _entropySalt
                )
            )
        );
        bytes32 encodedSalt = bytes32(
            abi.encodePacked(address(this), crosschainProtectionFlag, salt)
        );

        return
            createX.computeCreate2Address(
                encodedSalt,
                keccak256(
                    abi.encodePacked(type(CurvePoolBoosterProxy).creationCode)
                )
            );
    }
}
