
import "./Base.t.sol";

contract UserLockedFundsTest is Base {
    address user;
    uint constant userAmount = 10;
    uint constant agentAmount = 10_000;
    uint minimumVaultDAIBalance;

    function setUp() public override {
        rpc_url = "https://eth.llamarpc.com";
        super.setUp();

        user = makeAddr("User");
        deal(WETH, user, 1 ether);
        deal(DAI, user, userAmount);

        vm.startPrank(user);

        IERC20(DAI).approve(address(vault), userAmount);
        vault.mint(DAI, userAmount, 0);

        vm.stopPrank();

        minimumVaultDAIBalance = IERC20(DAI).balanceOf(address(vault));

        address agent = getAgent();
        deal(WETH, 100 ether);
        deal(DAI, agent, agentAmount);
        deal(USDT, agent, agentAmount);
        deal(USDC, agent, agentAmount);
    }

    function testTransfer(uint amount) public {
        vm.assume(amount > 0 && amount < 1e4);

        address bob = makeAddr("Bob");
        address alice = makeAddr("Alice");

        deal(WETH, bob, 1 ether);
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

    function invariantVaultBalanceNotDrained() public {
        require(IERC20(DAI).balanceOf(address(vault)) >= minimumVaultDAIBalance, 
            "Balance was drained ?!");
    }

    function invariantFundsLocked() public {
        uint balanceBefore = IERC20(DAI).balanceOf(user);

        // if funds are locked, user should be able to unlock
        (bool success,) = address(this).call(
            abi.encodeWithSignature("redeem()"));
        
        uint amount = IERC20(DAI).balanceOf(user) - balanceBefore;

        // should be able to get > 90% even despite the rounding issues in Origin
        require(success && amount >= userAmount * 9/10, "lost locked funds");

        // Relock the same amount for next fuzzing call
        deal(WETH, user, 1 ether);
        deal(DAI, user, userAmount);

        vm.startPrank(user);
        
        IERC20(DAI).approve(address(vault), userAmount);
        vault.mint(DAI, userAmount, 0);

        vm.stopPrank();
    }

    function redeem() public {
        vm.startPrank(user);
        vault.redeem(ousd.balanceOf(user), 0);
        vm.stopPrank();
    }
}