// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../Base.t.sol";
import { ERC4626 } from "../../../lib/openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract StrategyTest is Base, ERC4626 {
    uint constant agentAmount = 10 ether;
    address strategist;

    address bob;

    constructor() ERC4626(IERC20Metadata(DAI)) ERC20("Narya Platform", "NP") {}

    function setUp() public override {
        rpc_url = "https://eth-mainnet.g.alchemy.com/v2/aWKDYS_qpAtrZb4ao1QYRSQTMA7Hbkcc";
        platformAddress = address(this);

        super.setUp();

        bob = makeAddr("Bob");

        strategist = makeAddr("Strategist");

        address agent = getAgent();
        deal(WETH, agent, 100 ether);
        deal(DAI, agent, agentAmount);
        deal(USDT, agent, agentAmount);
        deal(USDC, agent, agentAmount);

        vm.startPrank(owner);

        strategy.setPTokenAddress(DAI, address(this));

        // reward = new NaryaReward("Narya Reward Token", "NR");
        address[] memory rewards = new address[](1);
        rewards[0] = address(USDC);
        
        strategy.setRewardTokenAddresses(rewards);
        
        VaultAdmin(address(vault)).setStrategistAddr(strategist);
        
        harvester.setSupportedStrategy(address(strategy), true);

        VaultAdmin(address(vault)).approveStrategy(address(strategy));
        VaultAdmin(address(vault)).setAssetDefaultStrategy(DAI, address(strategy));

        vm.stopPrank();
    }

    // emulate some rewards
    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        super.deposit(assets, receiver);
        deal(USDC, msg.sender, 3);
    }

    // check that we can withdraw at anytime from the strategy
    function testDepositWithdrawStrategy(uint amount) public {
        vm.assume(amount > 10 && amount < 1 ether);

        deal(DAI, bob, amount);

        // mint for bob and send to alice
        vm.startPrank(bob);

        uint oldDaiBalance = IERC20(DAI).balanceOf(address(bob));

        IERC20(DAI).approve(address(vault), amount);
        vault.mint(DAI, amount, 0);

        vault.allocate();

        require(IERC20(USDC).balanceOf(address(strategy)) == 3, 
            "no rewards given");
        
        require(balanceOf(address(strategy)) == amount, 
            "no shares given");
        
        require(IERC20(DAI).balanceOf(address(this)) == amount, 
            "vault didnt receive asset");

        vault.redeem(ousd.balanceOf(bob), 0);

        require(IERC20(DAI).balanceOf(address(bob)) >= oldDaiBalance * 9 / 10,
            "Lost more than 90% (accounting for rounding issues)");

        require(IERC20(USDC).balanceOf(address(strategy)) == 3,
            "rewards disappeared from strategy");

        // actually due to known rounding issues, the redeemed ousd
        // won't give you back the same amount as you deposited
        // this means, strategy will have leftover shares

        vm.stopPrank();
    }
}
