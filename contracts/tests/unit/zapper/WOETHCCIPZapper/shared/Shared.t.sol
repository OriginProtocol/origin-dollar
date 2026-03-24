// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {OETHProxy} from "contracts/proxies/Proxies.sol";
import {OETHVaultProxy} from "contracts/proxies/Proxies.sol";
import {WOETHProxy} from "contracts/proxies/Proxies.sol";
import {WOETH} from "contracts/token/WOETH.sol";
import {OETHZapper} from "contracts/zapper/OETHZapper.sol";
import {IOETHZapper} from "contracts/interfaces/IOETHZapper.sol";
import {WOETHCCIPZapper} from "contracts/zapper/WOETHCCIPZapper.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

abstract contract Unit_WOETHCCIPZapper_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////
    OETH internal oeth;
    OETHVault internal oethVault;
    OETHProxy internal oethProxy;
    OETHVaultProxy internal oethVaultProxy;
    WOETH internal woeth;
    WOETHProxy internal woethProxy;
    OETHZapper internal oethZapper;
    WOETHCCIPZapper internal woethCcipZapper;
    MockWETH internal mockWeth;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////
    uint64 internal constant DEST_CHAIN_SELECTOR = 4949039107694359620; // Arbitrum
    uint256 internal constant CCIP_FEE = 0.01 ether;
    bytes32 internal constant MOCK_MESSAGE_ID = keccak256("mock_message");
    address internal ccipRouter;
    IERC20 internal woethOnDestChain;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////
    function setUp() public virtual override {
        super.setUp();

        vm.warp(7 days);

        _deployMockContracts();
        _deployContracts();
        _deployWOETH();
        _deployOETHZapper();
        _deployWOETHCCIPZapper();
        _configureContracts();
        _mockCCIP();
        label();
    }

    function _deployMockContracts() internal {
        mockWeth = new MockWETH();
        weth = IERC20(address(mockWeth));
        ccipRouter = makeAddr("CCIPRouter");
        woethOnDestChain = IERC20(makeAddr("WOETHOnArbitrum"));
    }

    function _deployContracts() internal {
        vm.startPrank(deployer);

        OETH oethImpl = new OETH();
        OETHVault oethVaultImpl = new OETHVault(address(weth));

        oethProxy = new OETHProxy();
        oethVaultProxy = new OETHVaultProxy();

        oethProxy.initialize(
            address(oethImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            address(oethVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oeth = OETH(address(oethProxy));
        oethVault = OETHVault(address(oethVaultProxy));
    }

    function _deployWOETH() internal {
        vm.startPrank(deployer);

        WOETH woethImpl = new WOETH(ERC20(address(oeth)));
        woethProxy = new WOETHProxy();
        woethProxy.initialize(address(woethImpl), governor, "");

        vm.stopPrank();

        woeth = WOETH(address(woethProxy));

        vm.prank(governor);
        woeth.initialize();
    }

    function _deployOETHZapper() internal {
        oethZapper = new OETHZapper(address(oeth), address(woeth), address(oethVault), address(weth));
    }

    function _deployWOETHCCIPZapper() internal {
        woethCcipZapper = new WOETHCCIPZapper(
            ccipRouter,
            DEST_CHAIN_SELECTOR,
            woeth,
            woethOnDestChain,
            IOETHZapper(address(oethZapper)),
            IERC20(address(oeth))
        );
    }

    function _configureContracts() internal {
        vm.startPrank(governor);
        oethVault.unpauseCapital();
        oethVault.setStrategistAddr(strategist);
        oethVault.setMaxSupplyDiff(5e16);
        oethVault.setWithdrawalClaimDelay(600);
        oethVault.setDripDuration(0);
        oethVault.setRebaseRateMax(200e18);
        vm.stopPrank();
    }

    /// @dev Mock CCIP router's getFee() and ccipSend() functions
    function _mockCCIP() internal {
        _mockCCIPFee(CCIP_FEE);
        _mockCCIPSend(MOCK_MESSAGE_ID);
    }

    function _mockCCIPFee(uint256 fee) internal {
        vm.mockCall(ccipRouter, abi.encodeWithSelector(IRouterClient.getFee.selector), abi.encode(fee));
    }

    function _mockCCIPSend(bytes32 messageId) internal {
        vm.mockCall(ccipRouter, abi.encodeWithSelector(IRouterClient.ccipSend.selector), abi.encode(messageId));
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _dealETH(address to, uint256 amount) internal {
        vm.deal(to, amount);
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////
    function label() public {
        vm.label(address(weth), "WETH");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(address(woeth), "WOETH");
        vm.label(address(oethZapper), "OETHZapper");
        vm.label(address(woethCcipZapper), "WOETHCCIPZapper");
        vm.label(ccipRouter, "CCIPRouter");
    }
}
