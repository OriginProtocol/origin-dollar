pragma solidity ^0.8.19;

import "../Base.t.sol";
import "../VaultInvariants/VaultLockedUserInvariants.sol";

contract UserLockedFundsTest is Base, VaultLockedUserInvariants {
    uint constant agentAmount = 10 ether;

    function setUp() public override {
        rpc_url = "https://eth-mainnet.g.alchemy.com/v2/aWKDYS_qpAtrZb4ao1QYRSQTMA7Hbkcc";
        super.setUp();

        setUpVaultLockedUserInvariants();

        address agent = getAgent();
        deal(WETH, agentAmount);
        deal(DAI, agent, agentAmount);
        deal(USDT, agent, agentAmount);
        deal(USDC, agent, agentAmount);
    }

    function testTransfer(uint amount) public {
        vm.assume(amount > 0 && amount < 1e4);

        address bob = makeAddr("Bob");
        address alice = makeAddr("Alice");

        deal(DAI, bob, amount);

        // mint for bob and send to alice
        vm.startPrank(bob);

        IERC20(DAI).approve(address(vault), amount);
        vault.mint(DAI, amount, 0);

        uint balance = ousd.balanceOf(bob);
        ousd.transfer(alice, balance);
        require(ousd.balanceOf(alice) == balance, "Lost OUSD during transfer()");

        vm.stopPrank();

        // alice should be able to redeem the ousd received from bob
        vm.startPrank(alice);
        vault.redeem(ousd.balanceOf(alice), 0);
        vm.stopPrank();

        require(IERC20(DAI).balanceOf(alice) >= amount*9/10,
            "alice lost too much when redeeming");
    }

    function setUpVaultLockedUserInvariants() public override {
        _lockedUser = makeAddr("LockedUser");
        _userAmount = 10 ether;

        _ERC20tokenAddress = DAI;
        _ERC20tokensRedeemed = vault.getAllAssets();
        
        // for invariantVaultBalanceNotDrained
        lockFunds();
        _minimumVaultValue = getVaultTotalValue();
    }

    function lockFunds() public override {
        deal(_ERC20tokenAddress, _lockedUser, _userAmount);

        vm.startPrank(_lockedUser);

        IERC20(_ERC20tokenAddress).approve(address(vault), _userAmount);
        vault.mint(_ERC20tokenAddress, _userAmount, 0);

        require(ousd.balanceOf(_lockedUser) > 0, "No shares minted");

        vm.stopPrank();
    }

    function getVaultTotalValue() public override returns (uint256) {
        return vault.totalValue();
    }

    function redeem() public override {
        vm.startPrank(_lockedUser);
        vault.redeem(ousd.balanceOf(_lockedUser), 0);
        vm.stopPrank();
    }
}