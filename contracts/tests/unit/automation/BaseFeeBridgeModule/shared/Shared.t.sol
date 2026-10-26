// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";
import {Mocks} from "tests/utils/artifacts/Mocks.sol";

// --- Project imports
import {MockAsyncWithdrawalVault} from "tests/mocks/MockAsyncWithdrawalVault.sol";
import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

/// @dev Test-local handle on BaseFeeBridgeModule; nothing else in the repo consumes it.
interface IBaseFeeBridgeModule {
    function MIN_WITHDRAWAL_AMOUNT() external view returns (uint256);
    function OPERATOR_ROLE() external view returns (bytes32);
    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);
    function safeContract() external view returns (address);
    function vault() external view returns (address);
    function weth() external view returns (address);
    function ccipRouter() external view returns (address);
    function destinationChainSelector() external view returns (uint64);
    function feeSplitter() external view returns (address);
    function pendingRequestId() external view returns (uint256);
    function hasPendingRequest() external view returns (bool);
    function lastRequestAt() external view returns (uint256);
    function hasRole(bytes32 role, address account) external view returns (bool);
    function requestWithdrawal(uint256 oethbAmount) external;
    function claimAndBridge() external;
    function clearPendingRequest() external;
    function bridgeFee(uint256 wethAmount) external view returns (uint256);
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
    uint256 internal constant CCIP_FEE = 0.001 ether;
    uint256 internal constant VAULT_LIQUIDITY = 1_000 ether;
    uint256 internal constant CLAIM_DELAY = 600;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    MockSafeContract internal mockSafe;
    MockERC20 internal oethb;
    MockERC20 internal mockWeth;
    MockAsyncWithdrawalVault internal vault;
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

        vault = new MockAsyncWithdrawalVault(address(mockWeth), address(oethb));
        mockWeth.mint(address(vault), VAULT_LIQUIDITY);

        router = IMockCCIPRouter(vm.deployCode(Mocks.CCIP_ROUTER_MOCK));
        router.setFee(CCIP_FEE);

        module = _deployModule(operator, feeSplitter);

        vm.deal(address(mockSafe), 1 ether);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _deployModule(address _operator, address _feeSplitter) internal returns (IBaseFeeBridgeModule) {
        return IBaseFeeBridgeModule(
            vm.deployCode(
                Automation.BASE_FEE_BRIDGE_MODULE,
                abi.encode(address(mockSafe), _operator, address(vault), address(router), DEST_SELECTOR, _feeSplitter)
            )
        );
    }

    /// @dev Give the Safe `amount` OETHb and open a request for it through the module.
    function _request(uint256 amount) internal {
        oethb.mint(address(mockSafe), amount);
        vm.prank(operator);
        module.requestWithdrawal(amount);
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(address(oethb), "OETHb");
        vm.label(address(mockWeth), "WETH");
        vm.label(address(vault), "MockVault");
        vm.label(address(router), "MockCCIPRouter");
        vm.label(address(module), "BaseFeeBridgeModule");
    }
}
