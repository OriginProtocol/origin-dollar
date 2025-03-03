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
        // Deploy Implementation
        address impl = createX.deployCreate2(encodedSalt, bytecodeImpl);
        // Deploy and Init Proxy
        address pb = createX.deployCreate2AndInit(
            encodedSalt,
            bytecodeProxy,
            abi.encodeWithSignature(
                "initialize(address,address,bytes)",
                impl,
                governor(),
                abi.encodeWithSelector(
                    PoolBoosterCurveMainnet.initialize.selector,
                    _args.strategist,
                    _args.fee,
                    _args.feeCollector,
                    _args.campaignRemoteManager,
                    _args.votemarket
                )
            ),
            ICreateX.Values(0, 0)
        );

        _storePoolBoosterEntry(
            pb,
            _args.curveGauge,
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
