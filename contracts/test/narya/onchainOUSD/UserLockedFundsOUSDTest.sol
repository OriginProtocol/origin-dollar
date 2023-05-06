
import "../BaseOnChain.t.sol";
import "../VaultInvariants/VaultLockedUserInvariants.sol";

contract UserLockedFundsOUSDTest is Base, VaultLockedUserInvariants {
    uint constant agentAmount = 10_000;
    uint minimumVaultDAIBalance;

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
        _userAmount = 100;
        lockFunds();
        _minimumVaultValue = getVaultTotalValue();
    }

    function lockFunds() public override {
        deal(WETH, _lockedUser, _userAmount);
        deal(DAI, _lockedUser, _userAmount);

        vm.startPrank(_lockedUser);

        IERC20(DAI).approve(address(vault), _userAmount);
        vault.mint(DAI, _userAmount, 0);

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