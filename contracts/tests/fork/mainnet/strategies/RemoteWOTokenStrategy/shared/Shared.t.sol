// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {Base as BaseAddresses, Mainnet, CrossChain} from "tests/utils/Addresses.sol";
import {Adapters} from "tests/utils/artifacts/Adapters.sol";
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Strategies} from "tests/utils/artifacts/Strategies.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {IAdapter} from "contracts/interfaces/crosschainV3/IAdapter.sol";
import {IRemoteWOTokenStrategy} from "contracts/interfaces/crosschainV3/IRemoteWOTokenStrategy.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";

struct BaseStrategyConfig {
    address platformAddress;
    address vaultAddress;
}

/// @notice Shared fixture for the Ethereum-side Remote leg of the OETHb V3 pair.
///
///         Deploys Remote and both adapters fresh (per tests/README.md) and wires them to the
///         real OETH vault, wOETH, CCIP router and OP-Stack L1StandardBridge. The point of a
///         fork here is that the expensive inbound handlers touch all four.
abstract contract Fork_RemoteWOTokenStrategy_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    // Strategy-level message type discriminators (CrossChainV3Helper).
    uint32 internal constant DEPOSIT = 1;
    uint32 internal constant WITHDRAW_REQUEST = 3;
    uint32 internal constant WITHDRAW_CLAIM = 5;
    uint32 internal constant BALANCE_REPORT = 7;

    /// @dev Matches CANONICAL_MIN_GAS in scripts/deploy/mainnet/007_OETHbV3RemoteImpl.s.sol. Drives the
    ///      OP-Stack deposit burn: baseGas = 285_000 + 16*len + minGas*64/63.
    uint32 internal constant CANONICAL_MIN_GAS = 200_000;

    uint256 internal constant SEED_WOETH = 100 ether;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IRemoteWOTokenStrategy internal remote;
    IAdapter internal ccipAdapter;
    IAdapter internal superbridgeAdapter;
    IERC20 internal woeth;

    /// @dev Master's address on Base. Under CreateX peer parity this equals Remote's own
    ///      address; the tests only need a stable stand-in for the envelope sender.
    address internal peer;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();

        woeth = IERC20(Mainnet.WOETHProxy);

        _deployFreshContracts();
        _configureContracts();
        _seedRemote();
        _labelContracts();
    }

    function _deployFreshContracts() internal {
        IProxy strategyProxy = IProxy(vm.deployCode(Proxies.CROSS_CHAIN_STRATEGY_PROXY, abi.encode(governor)));
        peer = address(strategyProxy);

        address strategyImpl = vm.deployCode(
            Strategies.REMOTE_WOTOKEN_STRATEGY,
            abi.encode(
                // Remote has no vault; wOETH is its registry "platform".
                BaseStrategyConfig({platformAddress: Mainnet.WOETHProxy, vaultAddress: address(0)}),
                Mainnet.WETH,
                Mainnet.OETHProxy,
                Mainnet.WOETHProxy,
                Mainnet.OETHVaultProxy
            )
        );

        vm.prank(governor);
        strategyProxy.initialize(strategyImpl, governor, abi.encodeWithSignature("initialize(address)", operator));

        remote = IRemoteWOTokenStrategy(address(strategyProxy));

        // Inbound on Ethereum is CCIP (Base -> Ethereum). Outbound is Superbridge
        // (Ethereum -> Base): canonical ETH leg + CCIP message.
        IProxy ccipProxy = IProxy(vm.deployCode(Proxies.BRIDGE_ADAPTER_PROXY, abi.encode(governor)));
        address ccipImpl = vm.deployCode(Adapters.CCIP_ADAPTER, abi.encode(Mainnet.ccipRouterMainnet));
        vm.prank(governor);
        ccipProxy.initialize(ccipImpl, governor, "");
        ccipAdapter = IAdapter(address(ccipProxy));

        IProxy superProxy = IProxy(vm.deployCode(Proxies.BRIDGE_ADAPTER_PROXY, abi.encode(governor)));
        address superImpl = vm.deployCode(
            Adapters.SUPERBRIDGE_ADAPTER,
            abi.encode(Mainnet.BaseL1StandardBridge, Mainnet.ccipRouterMainnet, Mainnet.WETH)
        );
        vm.prank(governor);
        superProxy.initialize(superImpl, governor, "");
        superbridgeAdapter = IAdapter(address(superProxy));
    }

    function _configureContracts() internal {
        IAdapter.ChainConfig memory cfg = IAdapter.ChainConfig({
            paused: false,
            chainSelector: BaseAddresses.CCIPChainSelector,
            // Ethereum -> Base: the budget Master's callback gets on Base.
            destGasLimit: CrossChain.OETHB_V3_DEST_GAS_LIMIT_MAINNET_TO_BASE
        });

        vm.startPrank(governor);
        ccipAdapter.authorise(address(remote), cfg);
        superbridgeAdapter.authorise(address(remote), cfg);
        (bool ok,) = address(superbridgeAdapter)
            .call(abi.encodeWithSignature("setCanonicalMinGas(address,uint32)", address(remote), CANONICAL_MIN_GAS));
        require(ok, "setCanonicalMinGas failed");

        remote.setInboundAdapter(address(ccipAdapter));
        remote.setOutboundAdapter(address(superbridgeAdapter));
        remote.safeApproveAllTokens();
        vm.stopPrank();

        // Fee pool for the outbound leg — every inbound handler replies.
        vm.deal(address(remote), 100 ether);
    }

    function _seedRemote() internal {
        deal(Mainnet.WOETHProxy, address(remote), SEED_WOETH);
    }

    function _labelContracts() internal {
        vm.label(address(remote), "RemoteWOTokenStrategy");
        vm.label(address(ccipAdapter), "CCIPAdapter");
        vm.label(address(superbridgeAdapter), "SuperbridgeAdapter");
        vm.label(Mainnet.OETHVaultProxy, "OETHVault");
        vm.label(Mainnet.WOETHProxy, "wOETH");
        vm.label(Mainnet.BaseL1StandardBridge, "L1StandardBridge");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev The strategy-level envelope: abi.encode(msgType, nonce, body).
    function _envelope(uint32 msgType, uint64 nonce, bytes memory body) internal pure returns (bytes memory) {
        return abi.encode(msgType, nonce, body);
    }

    /// @dev Deliver an inbound message through the inbound-adapter seat and return the gas the
    ///      call consumed. Measured around a raw `call` so the figure is the handler's cost
    ///      plus a small, constant frame overhead — it over-measures, which is the safe
    ///      direction for an upper bound.
    function _deliverAndMeasure(bytes memory payload, uint256 amountReceived) internal returns (uint256 gasUsed) {
        bytes memory data = abi.encodeWithSignature(
            "receiveMessage(address,address,uint256,bytes)", peer, address(0), amountReceived, payload
        );

        vm.prank(address(ccipAdapter));
        uint256 before = gasleft();
        (bool ok, bytes memory ret) = address(remote).call(data);
        gasUsed = before - gasleft();

        if (!ok) {
            assembly {
                revert(add(ret, 0x20), mload(ret))
            }
        }
    }

    /// @dev Pin `block.basefee` to 1 gwei. `ResourceMetering._metered` divides the deposit
    ///      resource cost by `Math.max(block.basefee, 1 gwei)`, so this is the worst case for
    ///      the OP-Stack burn inside `bridgeETHTo` — and it makes the measurement deterministic
    ///      instead of a function of whatever the fork block's basefee happened to be.
    function _pinWorstCaseBasefee() internal {
        vm.fee(1 gwei);
    }
}
