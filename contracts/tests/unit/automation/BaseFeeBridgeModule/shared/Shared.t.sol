// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";
import {Mocks} from "tests/utils/artifacts/Mocks.sol";

// --- Project imports
import {MockCurvePool} from "tests/mocks/MockCurvePool.sol";
import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

/// @dev Test-local handle on BaseFeeBridgeModule; nothing else in the repo consumes it.
interface IBaseFeeBridgeModule {
    function MAX_SLIPPAGE_BPS() external view returns (uint256);
    function OPERATOR_ROLE() external view returns (bytes32);
    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);
    function safeContract() external view returns (address);
    function oethb() external view returns (address);
    function weth() external view returns (address);
    function curvePool() external view returns (address);
    function oethbIndex() external view returns (int128);
    function wethIndex() external view returns (int128);
    function ccipRouter() external view returns (address);
    function destinationChainSelector() external view returns (uint64);
    function feeSplitter() external view returns (address);
    function maxSlippageBps() external view returns (uint256);
    function hasRole(bytes32 role, address account) external view returns (bool);
    function bridgeFee(uint256 wethAmount) external view returns (uint256);
    function swapAndBridge(uint256 oethbAmount, uint256 minWethOut) external;
    function setMaxSlippageBps(uint256 maxSlippageBps) external;
}

/// @dev Test-local handle on the CCIP router mock.
interface IMockCCIPRouter {
    function setFee(uint256 fee) external;
    function sentMessagesLength() external view returns (uint256);
}

abstract contract Unit_BaseFeeBridgeModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint64 internal constant DEST_SELECTOR = 5009297550715157269;
    uint256 internal constant MAX_SLIPPAGE = 50;
    uint256 internal constant CCIP_FEE = 0.001 ether;
    uint256 internal constant POOL_LIQUIDITY = 1_000 ether;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    MockSafeContract internal mockSafe;
    MockERC20 internal oethb;
    MockERC20 internal mockWeth;
    MockCurvePool internal pool;
    IMockCCIPRouter internal router;
    IBaseFeeBridgeModule internal module;
    address internal feeSplitter;

    event MockCcipSend(
        uint64 destinationChainSelector, bytes receiver, address token, uint256 amount, uint256 valueReceived
    );

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        label();
    }

    function _deployContracts() internal {
        mockSafe = new MockSafeContract();
        oethb = new MockERC20("Super OETH", "superOETHb", 18);
        mockWeth = new MockERC20("Wrapped Ether", "WETH", 18);
        feeSplitter = makeAddr("FeeSplitter");

        // Same coin order as the production pool: coins[0] = WETH, coins[1] = OETHb.
        pool = new MockCurvePool(address(mockWeth), address(oethb));
        mockWeth.mint(address(pool), POOL_LIQUIDITY);
        oethb.mint(address(pool), POOL_LIQUIDITY);
        pool.setBalances(POOL_LIQUIDITY, POOL_LIQUIDITY);

        router = IMockCCIPRouter(vm.deployCode(Mocks.CCIP_ROUTER_MOCK));
        router.setFee(CCIP_FEE);

        module = _deployModule(address(pool));

        vm.deal(address(mockSafe), 1 ether);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _deployModule(address _pool) internal returns (IBaseFeeBridgeModule) {
        return IBaseFeeBridgeModule(
            vm.deployCode(
                Automation.BASE_FEE_BRIDGE_MODULE,
                abi.encode(
                    address(mockSafe),
                    operator,
                    address(oethb),
                    address(mockWeth),
                    _pool,
                    address(router),
                    DEST_SELECTOR,
                    feeSplitter,
                    MAX_SLIPPAGE
                )
            )
        );
    }

    function _floor(uint256 amount) internal pure returns (uint256) {
        return (amount * (1e4 - MAX_SLIPPAGE)) / 1e4;
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(address(oethb), "OETHb");
        vm.label(address(mockWeth), "WETH");
        vm.label(address(pool), "MockCurvePool");
        vm.label(address(router), "MockCCIPRouter");
        vm.label(address(module), "BaseFeeBridgeModule");
    }
}
