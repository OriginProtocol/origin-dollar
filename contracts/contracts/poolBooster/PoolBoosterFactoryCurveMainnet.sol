// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Interfaces
import { ICreateX } from "../interfaces/ICreateX.sol";

// Contracts
import { CurvePoolBoosterProxy } from "../proxies/Proxies.sol";
import { PoolBoosterCurveMainnet } from "./PoolBoosterCurveMainnet.sol";
import { AbstractPoolBoosterFactory, IPoolBoostCentralRegistry } from "./AbstractPoolBoosterFactory.sol";

contract PoolBoosterFactoryCurveMainnet is AbstractPoolBoosterFactory {
    uint256 public constant version = 1;

    ICreateX public constant createX =
        ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);

    struct CreatePoolBooster {
        uint256 targetChainId;
        address curveGauge;
        address strategist;
        uint16 fee;
        address feeCollector;
        address campaignRemoteManager;
        address votemarket;
        bytes32 entropySalt;
    }

    constructor(
        address _oToken,
        address _governor,
        address _centralRegistry
    ) AbstractPoolBoosterFactory(_oToken, _governor, _centralRegistry) {}

    function createPoolBoosterCurveMainnet(CreatePoolBooster calldata _args)
        external
        onlyGovernor
    {
        require(_args.curveGauge != address(0), "Invalid curve gauge address");
        require(_args.entropySalt != 0, "Invalid entropy salt");
        // --- Salts ---
        bytes1 crosschainProtectionFlag = hex"00"; // Need to be 0, otherwise cross-chain is blocked.
        bytes11 salt = bytes11(
            keccak256(
                abi.encodePacked(
                    oSonic,
                    _args.targetChainId,
                    _args.curveGauge,
                    _args.entropySalt
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
            abi.encode(_args.targetChainId, oSonic, _args.curveGauge)
        );
        // Proxy
        bytes memory bytecodeProxy = abi.encodePacked(
            type(CurvePoolBoosterProxy).creationCode
        );

        // --- Deploy ---
        address pb = _runDeployment(
            encodedSalt,
            bytecodeImpl,
            bytecodeProxy,
            _args
        );

        _storePoolBoosterEntry(
            pb,
            _args.curveGauge,
            IPoolBoostCentralRegistry.PoolBoosterType.CurveMainnetBooster
        );
    }

    // Done to avoid -stack too deep- error
    function _runDeployment(
        bytes32 _salt,
        bytes memory _bytecodeImpl,
        bytes memory _bytecodeProxy,
        CreatePoolBooster memory _data
    ) internal returns (address) {
        return
            createX.deployCreate3AndInit(
                _salt,
                _bytecodeProxy,
                abi.encodeWithSignature(
                    "initialize(address,address,bytes)",
                    createX.deployCreate3(_salt, _bytecodeImpl),
                    governor(),
                    abi.encodeWithSelector(
                        PoolBoosterCurveMainnet.initialize.selector,
                        _data.strategist,
                        _data.fee,
                        _data.feeCollector,
                        _data.campaignRemoteManager,
                        _data.votemarket
                    )
                ),
                ICreateX.Values(0, 0)
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
