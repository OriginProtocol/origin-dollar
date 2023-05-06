pragma solidity ^0.8.19;

import "../Base.t.sol";
import { ERC4626 } from "../../../lib/openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract StrategyInvariants is Base, ERC4626 {
    uint constant agentAmount = 10_000;
    address strategist;
    address bob;
    address rewardRecipient;

    struct LogInfo {
        uint state; // 0 deposit, 1 withdrawal, 2 reallocate
        uint expected;
        uint balance;
    }

    LogInfo[] pnmLogs;

    constructor() ERC4626(IERC20Metadata(DAI)) ERC20("Narya Platform", "NP") {}

    function setUp() public override {
        rpc_url = "https://eth-mainnet.g.alchemy.com/v2/aWKDYS_qpAtrZb4ao1QYRSQTMA7Hbkcc";
        platformAddress = address(this);
        dripperToken = USDT;

        super.setUp();

        bob = makeAddr("Bob");
        strategist = makeAddr("Strategist");

        address agent = getAgent();
        deal(WETH, agent, 100 ether);
        deal(DAI, agent, agentAmount);
        deal(USDT, agent, agentAmount);
        deal(USDC, agent, agentAmount);

        vm.startPrank(owner);

        dripper.setDripDuration(1);

        strategy.setPTokenAddress(DAI, address(this));

        // reward = new NaryaReward("Narya Reward Token", "NR");
        address[] memory rewards = new address[](1);
        rewards[0] = address(USDC);
        
        strategy.setRewardTokenAddresses(rewards);
        
        VaultAdmin(address(vault)).setStrategistAddr(strategist);
        
        harvester.setSupportedStrategy(address(strategy), true);

        VaultAdmin(address(vault)).approveStrategy(address(strategy));
        VaultAdmin(address(vault)).setAssetDefaultStrategy(DAI, address(strategy));

        harvester.setRewardTokenConfig(
            USDC,
            300,
            100,
            UNI_ROUTER,
            type(uint256).max,
            true
        );

        vm.stopPrank();
    }

    // emulate some rewards
    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        super.deposit(assets, receiver);
        deal(USDC, msg.sender, 100);
    }

    
    // Check that we can collect the fees to the harvester, then dripper, then vault
    function testDripper(uint amount) public {
        vm.assume(amount > 10 && amount < 1 ether);

        deal(DAI, bob, amount);

        // mint for bob and send to alice
        vm.startPrank(bob);

        uint oldDaiBalance = IERC20(DAI).balanceOf(address(bob));

        IERC20(DAI).approve(address(vault), amount);
        vault.mint(DAI, amount, 0);

        vault.allocate();

        require(IERC20(USDC).balanceOf(address(strategy)) == 100, 
            "no rewards given");
        
        require(balanceOf(address(strategy)) == amount, 
            "no shares given");
        
        require(IERC20(DAI).balanceOf(address(this)) == amount, 
            "vault didnt receive asset");

        vault.redeem(ousd.balanceOf(bob), 0);

        require(IERC20(DAI).balanceOf(address(bob)) >= oldDaiBalance * 9 / 10,
            "Lost more than 90% (accounting for rounding issues)");

        require(IERC20(USDC).balanceOf(address(strategy)) == 100,
            "rewards disappeared from strategy");

        // actually due to known rounding issues, the redeemed ousd
        // won't give you back the same amount as you deposited
        // this means, strategy will have leftover shares

        harvester.harvestAndSwap(address(strategy), rewardRecipient);
        
        // console.log("dripper", IERC20(USDT).balanceOf(address(dripper)));
        // console.log("rewardRecipient", IERC20(USDT).balanceOf(address(rewardRecipient)));
        
        
        require(IERC20(USDT).balanceOf(address(dripper)) > 0,
            "dripper didnt receive funds");

        vm.warp(block.timestamp + 1 minutes);
        dripper.collect();

        // vm.warp(block.timestamp + 1 minutes);
        // dripper.collect();
        require(IERC20(USDT).balanceOf(address(vault)) > 0,
            "vault didnt receive funds");

        // console.log(IERC20(USDT).balanceOf(address(vault)));

        vm.stopPrank();
    }

    function actionDeposit(uint256 amount) public {
        vm.assume(amount > 0);
        deal(DAI, address(vault), amount);

        address[] memory assets = new address[](1);
        assets[0] = DAI;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        uint oldBalance = strategy.checkBalance(DAI);

        vm.startPrank(strategist);
        VaultAdmin(address(vault)).depositToStrategy(
            address(strategy),
            assets,
            amounts
        );
        vm.stopPrank();

        pnmLogs.push(LogInfo(
            0,
            amount,
            strategy.checkBalance(DAI) - oldBalance
        ));
    }

    function actionWithdraw(uint256 amount) public {
        address[] memory assets = new address[](1);
        assets[0] = DAI;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        uint oldBalance = IERC20(DAI).balanceOf(address(strategy));
        vm.assume(amount > 0 && amount < oldBalance);

        vm.startPrank(strategist);
        VaultAdmin(address(vault)).withdrawFromStrategy(
            address(strategy),
            assets,
            amounts
        );
        vm.stopPrank();

        pnmLogs.push(LogInfo(
            1,
            amount,
            IERC20(DAI).balanceOf(address(strategy)) - oldBalance
        ));
    }

    function actionReallocate(uint256 amount) public {
        vm.assume(amount > 0);
        
        address[] memory assets = new address[](1);
        assets[0] = DAI;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        uint oldBalance = strategy.checkBalance(DAI);

        vm.startPrank(strategist);
        VaultAdmin(address(vault)).reallocate(
            address(strategy),
            address(strategy),
            assets,
            amounts
        );
        vm.stopPrank();

        pnmLogs.push(LogInfo(
            2,
            oldBalance,
            strategy.checkBalance(DAI)
        ));
    }

    function invariantStrategyAssets() public {
        for (uint i = 0; i < pnmLogs.length; ++i) {
            LogInfo memory info = pnmLogs[i];
            if (info.state == 0) {
                require(info.expected == info.balance, "strategy deposit failed");
            } else if (info.state == 1) {
                require(info.expected == info.balance, "strategy withdrawal failed");
            } else if (info.state == 2) {
                require(info.expected == info.balance, "strategy reallocate failed");
            }
        }

        delete pnmLogs;
    }
}
