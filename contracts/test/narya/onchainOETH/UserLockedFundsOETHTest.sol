
import "../BaseOnChain.t.sol";
import "../VaultInvariants/VaultLockedUserInvariants.sol";

contract UserLockedFundsOETHTest is Base, VaultLockedUserInvariants {
    uint constant agentAmount = 10_000;

    function setUp() public override {
        rpc_url = "https://eth-mainnet.g.alchemy.com/v2/aWKDYS_qpAtrZb4ao1QYRSQTMA7Hbkcc";
        ousdAddress = 0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3;
        vaultAddress = 0x39254033945AA2E4809Cc2977E7087BEE48bd7Ab;

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
        _ERC20tokenAddress = WETH;
        _userAmount = 100;
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