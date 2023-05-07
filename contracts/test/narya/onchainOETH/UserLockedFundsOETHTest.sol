
import "../BaseOnChain.t.sol";
import "../VaultInvariants/VaultLockedUserInvariants.sol";

contract UserLockedFundsOETHTest is Base, VaultLockedUserInvariants {
    uint constant agentAmount = 10 ether;

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
        _userAmount = 10 ether;

        _ERC20tokenAddress = WETH;
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

    function testFlashLoan(uint128 _amountToMint) public {
        // middle ground to not hit MAX_SUPPLY,
        // and somehow realistic for a flash loan
        vm.assume(_amountToMint > 0 && _amountToMint < 1_000_000_000_000 ether);
        
        address bob = makeAddr("bob");
        deal(WETH, bob, _amountToMint);

        address[] memory assets = vault.getAllAssets();

        vm.startPrank(bob);

        IERC20(WETH).approve(address(vault), _amountToMint);
        vault.mint(WETH, _amountToMint, 0);

        uint[] memory beforeBalances = new uint[](assets.length);
        for (uint i = 0; i < assets.length; ++i) {
            beforeBalances[i] = IERC20(assets[i]).balanceOf(bob);
        }

        vault.redeem(ousd.balanceOf(bob), 0);
        vm.stopPrank();

        uint totalAmount = 0;
        for (uint i = 0; i < assets.length; ++i) {
            IERC20 _token = IERC20(assets[i]);
            uint exponent = 18-_token.decimals();

            totalAmount += (_token.balanceOf(bob) - beforeBalances[i]) * (10**exponent);
        }

        uint exponent = 18-IERC20(WETH).decimals();
        require(totalAmount < (_amountToMint * (10**exponent)),
            "got more money than deposited");
    }
}