pragma solidity ^0.8.0;

contract OUSDResolutionUpgrade {
    enum RebaseOptions {
        NotSet,
        OptOut,
        OptIn
    }

    // From Initializable
    bool private initialized;
    bool private initializing;
    uint256[50] private ______igap;

    // From InitializableERC20Detailed
    uint256[100] private _____ugap;
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    // From OUSD
    uint256 private constant MAX_SUPPLY = ~uint128(0); // (2^128) - 1
    uint256 public _totalSupply;
    mapping(address => mapping(address => uint256)) private _allowances;
    address public vaultAddress = address(0);
    mapping(address => uint256) private _creditBalances;
    uint256 private _rebasingCredits;
    uint256 private _rebasingCreditsPerToken;
    uint256 public nonRebasingSupply;
    mapping(address => uint256) public nonRebasingCreditsPerToken;
    mapping(address => RebaseOptions) public rebaseState;
    mapping(address => uint256) public isUpgraded;

    uint256 private constant RESOLUTION_INCREASE = 1e9;

    /**
     * @return High resolution rebasingCreditsPerToken
     */
    function rebasingCreditsPerToken() public view returns (uint256) {
        return _rebasingCreditsPerToken / RESOLUTION_INCREASE;
    }

    /**
     * @return High resolution total number of rebasing credits
     */
    function rebasingCredits() public view returns (uint256) {
        return _rebasingCredits / RESOLUTION_INCREASE;
    }

    /**
     * @return High resolution rebasingCreditsPerToken
     */
    function rebasingCreditsPerTokenHighres() public view returns (uint256) {
        return _rebasingCreditsPerToken;
    }

    /**
     * @return High resolution total number of rebasing credits
     */
    function rebasingCreditsHighres() public view returns (uint256) {
        return _rebasingCredits;
    }

    function upgradeGlobals() external {
        require(isUpgraded[address(0)] == 0, "Globals already upgraded");
        require(_rebasingCredits > 0, "Sanity _rebasingCredits");
        require(
            _rebasingCreditsPerToken > 0,
            "Sanity _rebasingCreditsPerToken"
        );
        isUpgraded[address(0)] = 1;
        _rebasingCredits = _rebasingCredits * RESOLUTION_INCREASE;
        _rebasingCreditsPerToken =
            _rebasingCreditsPerToken *
            RESOLUTION_INCREASE;
    }

    function upgradeAccounts(address[] calldata accounts) external {
        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            require(account != address(0), "Reserved");
            require(isUpgraded[account] == 0, "Account already upgraded");
            isUpgraded[account] = 1;

            // Handle special for non-rebasing accounts
            uint256 nrc = nonRebasingCreditsPerToken[account];
            if (nrc > 0) {
                require(nrc < 1e18, "Account already highres");
                nonRebasingCreditsPerToken[account] = nrc * RESOLUTION_INCREASE;
            }
            // Upgrade balance
            uint256 balance = _creditBalances[account];
            require(balance > 0, "Will not upgrade zero balance");
            _creditBalances[account] = balance * RESOLUTION_INCREASE;
        }
    }

    function creditsBalanceOfHighres(address _account)
        public
        view
        returns (
            uint256,
            uint256,
            bool
        )
    {
        return (
            _creditBalances[_account],
            _creditsPerToken(_account),
            isUpgraded[_account] == 1
        );
    }

    /**
     * @dev Get the credits per token for an account. Returns a fixed amount
     *      if the account is non-rebasing.
     * @param _account Address of the account.
     */
    function _creditsPerToken(address _account)
        internal
        view
        returns (uint256)
    {
        if (nonRebasingCreditsPerToken[_account] != 0) {
            return nonRebasingCreditsPerToken[_account];
        } else {
            return _rebasingCreditsPerToken;
        }
    }
}
