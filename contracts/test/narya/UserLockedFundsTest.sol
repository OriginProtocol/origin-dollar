
import "./Base.t.sol";

contract UserLockedFundsTest is Base {
    address user;
    uint constant userAmount = 10;
    uint constant agentAmount = 10_000;
    uint minimumVaultDAIBalance;
    uint minimumLiveVaultWETHBalance;
    uint minimumLiveVaultDAIBalance;

    function setUp() public override {
        rpc_url = "https://eth-mainnet.g.alchemy.com/v2/aWKDYS_qpAtrZb4ao1QYRSQTMA7Hbkcc";
        super.setUp();

        user = makeAddr("User");
        deal(WETH, user, 1 ether);
        deal(DAI, user, userAmount);

        vm.startPrank(user);

        IERC20(DAI).approve(address(vault), userAmount);
        vault.mint(DAI, userAmount, 0);

        vm.stopPrank();

        minimumVaultDAIBalance = vault.checkBalance(DAI);

        address agent = getAgent();
        deal(WETH, 100 ether);
        deal(DAI, agent, agentAmount);
        deal(USDT, agent, agentAmount);
        deal(USDC, agent, agentAmount);

        liveSetup();
    }

    function liveSetup() public {
        // OETH
        deal(WETH, user, userAmount);
        deal(DAI, user, userAmount);

        uint balanceBefore = OETH(OETH_LIVE).balanceOf(user);

        vm.startPrank(user);

        IERC20(WETH).approve(OETH_VAULT_LIVE, userAmount);
        VaultCore(payable(OETH_VAULT_LIVE)).mint(WETH, userAmount, 0);

        require(
            OETH(OETH_LIVE).balanceOf(user) > balanceBefore,
            "Didnt mint any OETH from live contract"
        );

        minimumLiveVaultWETHBalance = VaultCore(payable(OETH_VAULT_LIVE)).checkBalance(WETH);

        vm.stopPrank();
        
        // OUSD
        deal(WETH, user, userAmount);
        deal(DAI, user, userAmount);

        balanceBefore = OUSD(OUSD_LIVE).balanceOf(user);

        vm.startPrank(user);

        IERC20(DAI).approve(OUSD_VAULT_LIVE, userAmount+100);
        VaultCore(payable(OUSD_VAULT_LIVE)).mint(DAI, userAmount, 0);

        require(
            OETH(OUSD_LIVE).balanceOf(user) > balanceBefore,
            "Didnt mint any OETH from live contract"
        );

        minimumLiveVaultDAIBalance = VaultCore(payable(OUSD_VAULT_LIVE)).checkBalance(DAI);

        vm.stopPrank();
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
        require(vault.checkBalance(DAI) >= minimumVaultDAIBalance * 9 / 10, 
            "Balance was drained ?!");
        
        require(
            VaultCore(payable(OETH_VAULT_LIVE)).checkBalance(WETH) >= minimumLiveVaultWETHBalance * 9 / 10, 
            "Live OETH vault Balance was drained ?!"
        );

        require(
            VaultCore(payable(OUSD_VAULT_LIVE)).checkBalance(DAI) >= minimumLiveVaultDAIBalance * 9 / 10, 
            "Live OUSD vault Balance was drained ?!"
        );
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

        // OETH Live

        // OUSD Live
    }

    function redeem() public {
        vm.startPrank(user);
        vault.redeem(ousd.balanceOf(user), 0);
        vm.stopPrank();
    }
}