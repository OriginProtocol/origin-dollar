
import "../BaseOnChain.t.sol";
import "../VaultInvariants/VaultLockedUserInvariants.sol";

contract UserLockedFundsOUSDTest is Base, VaultLockedUserInvariants {
    uint constant agentAmount = 10 ether;

    function setUp() public override {
        rpc_url = "https://eth-mainnet.g.alchemy.com/v2/aWKDYS_qpAtrZb4ao1QYRSQTMA7Hbkcc";
        ousdAddress = 0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86;
        vaultAddress = 0xE75D77B1865Ae93c7eaa3040B038D7aA7BC02F70;

        super.setUp();

        setUpVaultLockedUserInvariants();

        address agent = getAgent();
        deal(WETH, agentAmount);
        deal(DAI, agent, agentAmount);
        deal(USDT, agent, agentAmount);
        deal(USDC, agent, agentAmount);
    }

    function setUpVaultLockedUserInvariants() public override {
        _lockedUser = makeAddr("LockedUser");
        _ERC20tokenAddress = DAI;
        _userAmount = 10 ether;
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

    function testme() public {
        deal(_ERC20tokenAddress, _lockedUser, _userAmount);

        console.log("_userAmount", _userAmount);

        vm.startPrank(_lockedUser);

        console.log("DAI balance before mint", IERC20(_ERC20tokenAddress).balanceOf(_lockedUser));
        console.log("ousd balance before mint", ousd.balanceOf(_lockedUser));

        IERC20(_ERC20tokenAddress).approve(address(vault), _userAmount);
        vault.mint(_ERC20tokenAddress, _userAmount, 0);

        uint balanceBefore = IERC20(_ERC20tokenAddress).balanceOf(_lockedUser);
        console.log("DAI balance after mint", balanceBefore);
        console.log("ousd balance after mint", ousd.balanceOf(_lockedUser));

        require(ousd.balanceOf(_lockedUser) > 0, "No shares minted");

        vault.redeem(ousd.balanceOf(_lockedUser), 0);

        uint balanceAfter = IERC20(_ERC20tokenAddress).balanceOf(_lockedUser);
        console.log("DAI balance after redeem", balanceAfter);
        console.log("ousd balance after redeem", ousd.balanceOf(_lockedUser));
        console.log("USDC balance before mint", IERC20(USDC).balanceOf(_lockedUser));
        console.log("USDT balance before mint", IERC20(USDT).balanceOf(_lockedUser));
        console.log("USDT balance before mint", IERC20(WETH).balanceOf(_lockedUser));
        

        require(balanceAfter - balanceBefore >= (_userAmount * 9) / 10,
            "lost funds");

        revert();

        vm.stopPrank();
    }
}