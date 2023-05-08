pragma solidity ^0.8.19;

import "../BaseOnChain.t.sol";
import { IMintableERC20, MintableERC20, ERC20 } from "../../../contracts/mocks/MintableERC20.sol";
import { IRewardStaking } from "../../../contracts/strategies/IRewardStaking.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ConvexOUSDMetaStrategy} from "../../../contracts/strategies/ConvexOUSDMetaStrategy.sol";
import {BaseConvexMetaStrategy} from "../../../contracts/strategies/BaseConvexMetaStrategy.sol";

contract MetaOUSD is Base {
    uint constant agentAmount = 10 ether;
    address bob;
    address alice;
    ConvexOUSDMetaStrategy meta;

    address CRV = 0xD533a949740bb3306d119CC777fa900bA034cd52;
    address ThreePool = 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7;
    address ThreePoolToken = 0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490;
    address CVX = 0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B;

    struct LogInfo {
        uint state; // 1 mint, 2 redeem
        address target;
        uint oldOusdBalance;
        uint newOusdBalance;
        uint oldStableBalance;
        uint newStableBalance;
    }

    LogInfo[] pnmLogs;

    function setUp() public override {
        rpc_url = "https://eth-mainnet.g.alchemy.com/v2/aWKDYS_qpAtrZb4ao1QYRSQTMA7Hbkcc";
        ousdAddress = 0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86;
        vaultAddress = 0xE75D77B1865Ae93c7eaa3040B038D7aA7BC02F70;

        super.setUp();

        bob = makeAddr("bob");
        alice = makeAddr("alice");

        meta = ConvexOUSDMetaStrategy(0x89Eb88fEdc50FC77ae8a18aAD1cA0ac27f777a90);
    }
    
    // Check that we can collect the fees to the harvester, then dripper, then vault
    function testMetaOusd(uint amount) public {
        vm.assume(amount >= 10 ether && amount < 100 ether);

        deal(DAI, bob, amount);

        vm.startPrank(bob);

        IERC20(DAI).approve(address(vault), amount);
        vault.mint(DAI, amount, 0);
        vault.allocate();

        vault.redeem(ousd.balanceOf(bob), 0);

        vm.stopPrank();

        require(IERC20(DAI).balanceOf(bob) > 0,
            "did not get back any funds");
    }

    function actionDeposit(uint amount, bool isBob) public {
        vm.assume(amount >= 10 ether && amount < 100 ether);

        address target = bob;
        if (!isBob) target = alice;

        deal(DAI, target, amount);

        uint oldOusdBalance = ousd.balanceOf(target);

        vm.startPrank(target);

        IERC20(DAI).approve(address(vault), amount);
        vault.mint(DAI, amount, 0);

        vm.stopPrank();

        pnmLogs.push(LogInfo(
            1,
            target,
            oldOusdBalance,
            ousd.balanceOf(target),
            0,
            0
        ));
    }

    function actionWithdraw(bool isBob) public {
        vm.assume(ousd.balanceOf(bob) > 0 || ousd.balanceOf(alice) > 0);
        
        address target = bob;
        if (!isBob || ousd.balanceOf(bob) == 0) target = alice;
        
        uint oldBalance = IERC20(DAI).balanceOf(target);

        vm.startPrank(target);

        vault.redeem(ousd.balanceOf(bob), 0);

        vm.stopPrank();

        pnmLogs.push(LogInfo(
            2,
            target,
            0,
            0,
            oldBalance,
            IERC20(DAI).balanceOf(target)
        ));
    }

    function invariantMetaOusd2() public {
        for (uint i = 0; i < pnmLogs.length; ++i) {
            LogInfo memory log = pnmLogs[i];
            if (log.state == 1) {
                require(log.oldOusdBalance < log.newOusdBalance,
                    "didnt mint any ousd");
            } else if (log.state == 2) {
                require(log.newStableBalance != 0 && log.oldStableBalance < log.newStableBalance,
                    "didnt redeem any stable");
            }
        }

        delete pnmLogs;
    }
}