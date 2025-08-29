// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface ISonicARM {
    error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed);
    error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);
    error ERC20InvalidApprover(address approver);
    error ERC20InvalidReceiver(address receiver);
    error ERC20InvalidSender(address sender);
    error ERC20InvalidSpender(address spender);
    error InvalidInitialization();
    error NotInitializing();
    error SafeCastOverflowedIntDowncast(uint8 bits, int256 value);
    error SafeCastOverflowedIntToUint(int256 value);
    error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
    error SafeCastOverflowedUintToInt(uint256 value);

    event ARMBufferUpdated(uint256 armBuffer);
    event ActiveMarketUpdated(address indexed market);
    event AdminChanged(address previousAdmin, address newAdmin);
    event Allocated(address indexed market, int256 assets);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event CapManagerUpdated(address indexed capManager);
    event ClaimOriginWithdrawals(uint256[] requestIds, uint256 amountClaimed);
    event CrossPriceUpdated(uint256 crossPrice);
    event Deposit(address indexed owner, uint256 assets, uint256 shares);
    event FeeCollected(address indexed feeCollector, uint256 fee);
    event FeeCollectorUpdated(address indexed newFeeCollector);
    event FeeUpdated(uint256 fee);
    event Initialized(uint64 version);
    event MarketAdded(address indexed market);
    event MarketRemoved(address indexed market);
    event OperatorChanged(address newAdmin);
    event RedeemClaimed(address indexed withdrawer, uint256 indexed requestId, uint256 assets);
    event RedeemRequested(
        address indexed withdrawer, uint256 indexed requestId, uint256 assets, uint256 queued, uint256 claimTimestamp
    );
    event RequestOriginWithdrawal(uint256 amount, uint256 requestId);
    event TraderateChanged(uint256 traderate0, uint256 traderate1);
    event Transfer(address indexed from, address indexed to, uint256 value);

    function FEE_SCALE() external view returns (uint256);
    function MAX_CROSS_PRICE_DEVIATION() external view returns (uint256);
    function PRICE_SCALE() external view returns (uint256);
    function activeMarket() external view returns (address);
    function addMarkets(address[] memory _markets) external;
    function allocate() external returns (int256 liquidityDelta);
    function allocateThreshold() external view returns (int256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function armBuffer() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function baseAsset() external view returns (address);
    function capManager() external view returns (address);
    function claimDelay() external view returns (uint256);
    function claimOriginWithdrawals(uint256[] memory requestIds) external returns (uint256 amountClaimed);
    function claimRedeem(uint256 requestId) external returns (uint256 assets);
    function claimable() external view returns (uint256 claimableAmount);
    function collectFees() external returns (uint256 fees);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function convertToShares(uint256 assets) external view returns (uint256 shares);
    function crossPrice() external view returns (uint256);
    function decimals() external view returns (uint8);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function deposit(uint256 assets) external returns (uint256 shares);
    function fee() external view returns (uint16);
    function feeCollector() external view returns (address);
    function feesAccrued() external view returns (uint256 fees);
    function initialize(
        string memory _name,
        string memory _symbol,
        address _operator,
        uint256 _fee,
        address _feeCollector,
        address _capManager
    ) external;
    function lastAvailableAssets() external view returns (int128);
    function liquidityAsset() external view returns (address);
    function minSharesToRedeem() external view returns (uint256);
    function name() external view returns (string memory);
    function nextWithdrawalIndex() external view returns (uint256);
    function operator() external view returns (address);
    function owner() external view returns (address);
    function previewDeposit(uint256 assets) external view returns (uint256 shares);
    function previewRedeem(uint256 shares) external view returns (uint256 assets);
    function removeMarket(address _market) external;
    function requestOriginWithdrawal(uint256 amount) external returns (uint256 requestId);
    function requestRedeem(uint256 shares) external returns (uint256 requestId, uint256 assets);
    function setARMBuffer(uint256 _armBuffer) external;
    function setActiveMarket(address _market) external;
    function setCapManager(address _capManager) external;
    function setCrossPrice(uint256 newCrossPrice) external;
    function setFee(uint256 _fee) external;
    function setFeeCollector(address _feeCollector) external;
    function setOperator(address newOperator) external;
    function setOwner(address newOwner) external;
    function setPrices(uint256 buyT1, uint256 sellT1) external;
    function supportedMarkets(address market) external view returns (bool supported);
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] memory path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    function swapExactTokensForTokens(
        address inToken,
        address outToken,
        uint256 amountIn,
        uint256 amountOutMin,
        address to
    ) external;
    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] memory path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    function swapTokensForExactTokens(
        address inToken,
        address outToken,
        uint256 amountOut,
        uint256 amountInMax,
        address to
    ) external;
    function symbol() external view returns (string memory);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function totalAssets() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function traderate0() external view returns (uint256);
    function traderate1() external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function vault() external view returns (address);
    function vaultWithdrawalAmount() external view returns (uint256);
    function withdrawalRequests(uint256 requestId)
        external
        view
        returns (address withdrawer, bool claimed, uint40 claimTimestamp, uint128 assets, uint128 queued);
    function withdrawsClaimed() external view returns (uint128);
    function withdrawsQueued() external view returns (uint128);
}