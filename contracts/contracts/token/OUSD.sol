// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OUSD Token Contract
 * @dev ERC20 compatible contract for OUSD
 * @dev Implements an elastic supply
 * @author Origin Protocol Inc
 */
import { IVault } from "../interfaces/IVault.sol";
import { Governable } from "../governance/Governable.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

contract OUSD is Governable {
    using SafeCast for int256;
    using SafeCast for uint256;

    /// @dev Event triggered when the supply changes
    /// @param totalSupply Updated token total supply
    /// @param rebasingCredits Updated token rebasing credits
    /// @param rebasingCreditsPerToken Updated token rebasing credits per token
    event TotalSupplyUpdatedHighres(
        uint256 totalSupply,
        uint256 rebasingCredits,
        uint256 rebasingCreditsPerToken
    );
    /// @dev Event triggered when an account opts in for rebasing
    /// @param account Address of the account
    event AccountRebasingEnabled(address account);
    /// @dev Event triggered when an account opts out of rebasing
    /// @param account Address of the account
    event AccountRebasingDisabled(address account);
    /// @dev Emitted when `value` tokens are moved from one account `from` to
    ///      another `to`.
    /// @param from Address of the account tokens are moved from
    /// @param to Address of the account tokens are moved to
    /// @param value Amount of tokens transferred
    event Transfer(address indexed from, address indexed to, uint256 value);
    /// @dev Emitted when the allowance of a `spender` for an `owner` is set by
    ///      a call to {approve}. `value` is the new allowance.
    /// @param owner Address of the owner approving allowance
    /// @param spender Address of the spender allowance is granted to
    /// @param value Amount of tokens spender can transfer
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
    /// @dev Yield resulting from {changeSupply} that a `source` account would
    ///      receive is directed to `target` account.
    /// @param source Address of the source forwarding the yield
    /// @param target Address of the target receiving the yield
    event YieldDelegated(address source, address target);
    /// @dev Yield delegation from `source` account to the `target` account is
    ///      suspended.
    /// @param source Address of the source suspending yield forwarding
    /// @param target Address of the target no longer receiving yield from `source`
    ///        account
    event YieldUndelegated(address source, address target);

    enum RebaseOptions {
        NotSet,
        StdNonRebasing,
        StdRebasing,
        YieldDelegationSource,
        YieldDelegationTarget
    }

    uint256[154] private _gap; // Slots to align with deployed contract
    uint256 private constant MAX_SUPPLY = type(uint128).max;
    /// @dev The amount of tokens in existence
    uint256 public totalSupply;
    mapping(address => mapping(address => uint256)) private allowances;
    /// @dev The vault with privileges to execute {mint}, {burn}
    ///     and {changeSupply}
    address public vaultAddress;
    mapping(address => uint256) internal creditBalances;
    // the 2 storage variables below need trailing underscores to not name collide with public functions
    uint256 private rebasingCredits_; // Sum of all rebasing credits (creditBalances for rebasing accounts)
    uint256 private rebasingCreditsPerToken_;
    /// @dev The amount of tokens that are not rebasing - receiving yield
    uint256 public nonRebasingSupply;
    mapping(address => uint256) internal alternativeCreditsPerToken;
    /// @dev A map of all addresses and their respective RebaseOptions
    mapping(address => RebaseOptions) public rebaseState;
    mapping(address => uint256) private __deprecated_isUpgraded;
    /// @dev A map of addresses that have yields forwarded to. This is an
    ///      inverse mapping of {yieldFrom}
    /// Key Account forwarding yield
    /// Value Account receiving yield
    mapping(address => address) public yieldTo;
    /// @dev A map of addresses that are receiving the yield. This is an
    ///      inverse mapping of {yieldTo}
    /// Key Account receiving yield
    /// Value Account forwarding yield
    mapping(address => address) public yieldFrom;

    uint256 private constant RESOLUTION_INCREASE = 1e9;
    uint256[34] private __gap; // including below gap totals up to 200

    /// @dev Verifies that the caller is the Governor or Strategist.
    modifier onlyGovernorOrStrategist() {
        require(
            isGovernor() || msg.sender == IVault(vaultAddress).strategistAddr(),
            "Caller is not the Strategist or Governor"
        );
        _;
    }

    /// @dev Initializes the contract and sets necessary variables.
    /// @param _vaultAddress Address of the vault contract
    /// @param _initialCreditsPerToken The starting rebasing credits per token.
    function initialize(address _vaultAddress, uint256 _initialCreditsPerToken)
        external
        onlyGovernor
    {
        require(_vaultAddress != address(0), "Zero vault address");
        require(vaultAddress == address(0), "Already initialized");

        rebasingCreditsPerToken_ = _initialCreditsPerToken;
        vaultAddress = _vaultAddress;
    }

    /// @dev Returns the symbol of the token, a shorter version
    ///      of the name.
    function symbol() external pure virtual returns (string memory) {
        return "OUSD";
    }

    /// @dev Returns the name of the token.
    function name() external pure virtual returns (string memory) {
        return "Origin Dollar";
    }

    /// @dev Returns the number of decimals used to get its user representation.
    function decimals() external pure virtual returns (uint8) {
        return 18;
    }

    /**
     * @dev Verifies that the caller is the Vault contract
     */
    modifier onlyVault() {
        require(vaultAddress == msg.sender, "Caller is not the Vault");
        _;
    }

    /**
     * @return High resolution rebasingCreditsPerToken
     */
    function rebasingCreditsPerTokenHighres() external view returns (uint256) {
        return rebasingCreditsPerToken_;
    }

    /**
     * @return Low resolution rebasingCreditsPerToken
     */
    function rebasingCreditsPerToken() external view returns (uint256) {
        return rebasingCreditsPerToken_ / RESOLUTION_INCREASE;
    }

    /**
     * @return High resolution total number of rebasing credits
     */
    function rebasingCreditsHighres() external view returns (uint256) {
        return rebasingCredits_;
    }

    /**
     * @return Low resolution total number of rebasing credits
     */
    function rebasingCredits() external view returns (uint256) {
        return rebasingCredits_ / RESOLUTION_INCREASE;
    }

    /**
     * @notice Gets the balance of the specified address.
     * @param _account Address to query the balance of.
     * @return A uint256 representing the amount of base units owned by the
     *         specified address.
     */
    function balanceOf(address _account) public view returns (uint256) {
        RebaseOptions state = rebaseState[_account];
        if (state == RebaseOptions.YieldDelegationSource) {
            // Saves a slot read when transferring to or from a yield delegating source
            // since we know creditBalances equals the balance.
            return creditBalances[_account];
        }
        uint256 baseBalance = (creditBalances[_account] * 1e18) /
            _creditsPerToken(_account);
        if (state == RebaseOptions.YieldDelegationTarget) {
            // creditBalances of yieldFrom accounts equals token balances
            return baseBalance - creditBalances[yieldFrom[_account]];
        }
        return baseBalance;
    }

    /**
     * @notice Gets the credits balance of the specified address.
     * @dev Backwards compatible with old low res credits per token.
     * @param _account The address to query the balance of.
     * @return (uint256, uint256) Credit balance and credits per token of the
     *         address
     */
    function creditsBalanceOf(address _account)
        external
        view
        returns (uint256, uint256)
    {
        uint256 cpt = _creditsPerToken(_account);
        if (cpt == 1e27) {
            // For a period before the resolution upgrade, we created all new
            // contract accounts at high resolution. Since they are not changing
            // as a result of this upgrade, we will return their true values
            return (creditBalances[_account], cpt);
        } else {
            return (
                creditBalances[_account] / RESOLUTION_INCREASE,
                cpt / RESOLUTION_INCREASE
            );
        }
    }

    /**
     * @notice Gets the credits balance of the specified address.
     * @param _account The address to query the balance of.
     * @return (uint256, uint256, bool) Credit balance, credits per token of the
     *         address, and isUpgraded
     */
    function creditsBalanceOfHighres(address _account)
        external
        view
        returns (
            uint256,
            uint256,
            bool
        )
    {
        return (
            creditBalances[_account],
            _creditsPerToken(_account),
            true // all accounts have their resolution "upgraded"
        );
    }

    // Backwards compatible view
    function nonRebasingCreditsPerToken(address _account)
        external
        view
        returns (uint256)
    {
        return alternativeCreditsPerToken[_account];
    }

    /**
     * @notice Transfer tokens to a specified address.
     * @param _to the address to transfer to.
     * @param _value the amount to be transferred.
     * @return true on success.
     */
    function transfer(address _to, uint256 _value) external returns (bool) {
        require(_to != address(0), "Transfer to zero address");

        _executeTransfer(msg.sender, _to, _value);

        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    /**
     * @notice Transfer tokens from one address to another.
     * @param _from The address you want to send tokens from.
     * @param _to The address you want to transfer to.
     * @param _value The amount of tokens to be transferred.
     * @return true on success.
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool) {
        require(_to != address(0), "Transfer to zero address");
        uint256 userAllowance = allowances[_from][msg.sender];
        require(_value <= userAllowance, "Allowance exceeded");

        unchecked {
            allowances[_from][msg.sender] = userAllowance - _value;
        }

        _executeTransfer(_from, _to, _value);

        emit Transfer(_from, _to, _value);
        return true;
    }

    function _executeTransfer(
        address _from,
        address _to,
        uint256 _value
    ) internal {
        (
            int256 fromRebasingCreditsDiff,
            int256 fromNonRebasingSupplyDiff
        ) = _adjustAccount(_from, -_value.toInt256());
        (
            int256 toRebasingCreditsDiff,
            int256 toNonRebasingSupplyDiff
        ) = _adjustAccount(_to, _value.toInt256());

        _adjustGlobals(
            fromRebasingCreditsDiff + toRebasingCreditsDiff,
            fromNonRebasingSupplyDiff + toNonRebasingSupplyDiff
        );
    }

    function _adjustAccount(address _account, int256 _balanceChange)
        internal
        returns (int256 rebasingCreditsDiff, int256 nonRebasingSupplyDiff)
    {
        RebaseOptions state = rebaseState[_account];
        int256 currentBalance = balanceOf(_account).toInt256();
        if (currentBalance + _balanceChange < 0) {
            revert("Transfer amount exceeds balance");
        }
        uint256 newBalance = (currentBalance + _balanceChange).toUint256();

        if (state == RebaseOptions.YieldDelegationSource) {
            address target = yieldTo[_account];
            uint256 targetOldBalance = balanceOf(target);
            uint256 targetNewCredits = _balanceToRebasingCredits(
                targetOldBalance + newBalance
            );
            rebasingCreditsDiff =
                targetNewCredits.toInt256() -
                creditBalances[target].toInt256();

            creditBalances[_account] = newBalance;
            creditBalances[target] = targetNewCredits;
        } else if (state == RebaseOptions.YieldDelegationTarget) {
            uint256 newCredits = _balanceToRebasingCredits(
                newBalance + creditBalances[yieldFrom[_account]]
            );
            rebasingCreditsDiff =
                newCredits.toInt256() -
                creditBalances[_account].toInt256();
            creditBalances[_account] = newCredits;
        } else {
            _autoMigrate(_account);
            uint256 alternativeCreditsPerTokenMem = alternativeCreditsPerToken[
                _account
            ];
            if (alternativeCreditsPerTokenMem > 0) {
                nonRebasingSupplyDiff = _balanceChange;
                if (alternativeCreditsPerTokenMem != 1e18) {
                    alternativeCreditsPerToken[_account] = 1e18;
                }
                creditBalances[_account] = newBalance;
            } else {
                uint256 newCredits = _balanceToRebasingCredits(newBalance);
                rebasingCreditsDiff =
                    newCredits.toInt256() -
                    creditBalances[_account].toInt256();
                creditBalances[_account] = newCredits;
            }
        }
    }

    function _adjustGlobals(
        int256 _rebasingCreditsDiff,
        int256 _nonRebasingSupplyDiff
    ) internal {
        if (_rebasingCreditsDiff != 0) {
            rebasingCredits_ = (rebasingCredits_.toInt256() +
                _rebasingCreditsDiff).toUint256();
        }
        if (_nonRebasingSupplyDiff != 0) {
            nonRebasingSupply = (nonRebasingSupply.toInt256() +
                _nonRebasingSupplyDiff).toUint256();
        }
    }

    /**
     * @notice Function to check the amount of tokens that _owner has allowed
     *      to `_spender`.
     * @param _owner The address which owns the funds.
     * @param _spender The address which will spend the funds.
     * @return The number of tokens still available for the _spender.
     */
    function allowance(address _owner, address _spender)
        external
        view
        returns (uint256)
    {
        return allowances[_owner][_spender];
    }

    /**
     * @notice Approve the passed address to spend the specified amount of
     *      tokens on behalf of msg.sender.
     * @param _spender The address which will spend the funds.
     * @param _value The amount of tokens to be spent.
     * @return true on success.
     */
    function approve(address _spender, uint256 _value) external returns (bool) {
        allowances[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    /**
     * @notice Creates `_amount` tokens and assigns them to `_account`,
     *     increasing the total supply.
     */
    function mint(address _account, uint256 _amount) external onlyVault {
        require(_account != address(0), "Mint to the zero address");

        // Account
        (
            int256 toRebasingCreditsDiff,
            int256 toNonRebasingSupplyDiff
        ) = _adjustAccount(_account, _amount.toInt256());
        // Globals
        _adjustGlobals(toRebasingCreditsDiff, toNonRebasingSupplyDiff);
        totalSupply = totalSupply + _amount;

        require(totalSupply < MAX_SUPPLY, "Max supply");
        emit Transfer(address(0), _account, _amount);
    }

    /**
     * @notice Destroys `_amount` tokens from `_account`,
     *     reducing the total supply.
     */
    function burn(address _account, uint256 _amount) external onlyVault {
        require(_account != address(0), "Burn from the zero address");
        if (_amount == 0) {
            return;
        }

        // Account
        (
            int256 toRebasingCreditsDiff,
            int256 toNonRebasingSupplyDiff
        ) = _adjustAccount(_account, -_amount.toInt256());
        // Globals
        _adjustGlobals(toRebasingCreditsDiff, toNonRebasingSupplyDiff);
        totalSupply = totalSupply - _amount;

        emit Transfer(_account, address(0), _amount);
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
        uint256 alternativeCreditsPerTokenMem = alternativeCreditsPerToken[
            _account
        ];
        if (alternativeCreditsPerTokenMem != 0) {
            return alternativeCreditsPerTokenMem;
        } else {
            return rebasingCreditsPerToken_;
        }
    }

    /**
     * @dev Auto migrate contracts to be non rebasing,
     *     unless they have opted into yield.
     * @param _account Address of the account.
     */
    function _autoMigrate(address _account) internal {
        uint256 codeLen = _account.code.length;
        bool isEOA = (codeLen == 0) ||
            (codeLen == 23 && bytes3(_account.code) == 0xef0100);
        // In previous code versions, contracts would not have had their
        // rebaseState[_account] set to RebaseOptions.NonRebasing when migrated
        // therefore we check the actual accounting used on the account as well.
        if (
            (!isEOA) &&
            rebaseState[_account] == RebaseOptions.NotSet &&
            alternativeCreditsPerToken[_account] == 0
        ) {
            _rebaseOptOut(_account);
        }
    }

    /**
     * @dev Calculates credits from contract's global rebasingCreditsPerToken_, and
     *      also balance that corresponds to those credits. The latter is important
     *      when adjusting the contract's global nonRebasingSupply to circumvent any
     *      possible rounding errors.
     *
     * @param _balance Balance of the account.
     */
    function _balanceToRebasingCredits(uint256 _balance)
        internal
        view
        returns (uint256 rebasingCredits)
    {
        // Rounds up, because we need to ensure that accounts always have
        // at least the balance that they should have.
        // Note this should always be used on an absolute account value,
        // not on a possibly negative diff, because then the rounding would be wrong.
        return ((_balance) * rebasingCreditsPerToken_ + 1e18 - 1) / 1e18;
    }

    /**
     * @notice The calling account will start receiving yield after a successful call.
     * @param _account Address of the account.
     */
    function governanceRebaseOptIn(address _account) external onlyGovernor {
        require(_account != address(0), "Zero address not allowed");
        _rebaseOptIn(_account);
    }

    /**
     * @notice The calling account will start receiving yield after a successful call.
     */
    function rebaseOptIn() external {
        _rebaseOptIn(msg.sender);
    }

    function _rebaseOptIn(address _account) internal {
        uint256 balance = balanceOf(_account);

        // prettier-ignore
        require(
            alternativeCreditsPerToken[_account] > 0 ||
                // Accounts may explicitly `rebaseOptIn` regardless of
                // accounting if they have a 0 balance.
                creditBalances[_account] == 0
            ,
            "Account must be non-rebasing"
        );
        RebaseOptions state = rebaseState[_account];
        // prettier-ignore
        require(
            state == RebaseOptions.StdNonRebasing ||
                state == RebaseOptions.NotSet,
            "Only standard non-rebasing accounts can opt in"
        );

        uint256 newCredits = _balanceToRebasingCredits(balance);

        // Account
        rebaseState[_account] = RebaseOptions.StdRebasing;
        alternativeCreditsPerToken[_account] = 0;
        creditBalances[_account] = newCredits;
        // Globals
        _adjustGlobals(newCredits.toInt256(), -balance.toInt256());

        emit AccountRebasingEnabled(_account);
    }

    /**
     * @notice The calling account will no longer receive yield
     */
    function rebaseOptOut() external {
        _rebaseOptOut(msg.sender);
    }

    function _rebaseOptOut(address _account) internal {
        require(
            alternativeCreditsPerToken[_account] == 0,
            "Account must be rebasing"
        );
        RebaseOptions state = rebaseState[_account];
        require(
            state == RebaseOptions.StdRebasing || state == RebaseOptions.NotSet,
            "Only standard rebasing accounts can opt out"
        );

        uint256 oldCredits = creditBalances[_account];
        uint256 balance = balanceOf(_account);

        // Account
        rebaseState[_account] = RebaseOptions.StdNonRebasing;
        alternativeCreditsPerToken[_account] = 1e18;
        creditBalances[_account] = balance;
        // Globals
        _adjustGlobals(-oldCredits.toInt256(), balance.toInt256());

        emit AccountRebasingDisabled(_account);
    }

    /**
     * @notice Distribute yield to users. This changes the exchange rate
     *  between "credits" and OUSD tokens to change rebasing user's balances.
     * @param _newTotalSupply New total supply of OUSD.
     */
    function changeSupply(uint256 _newTotalSupply) external onlyVault {
        require(totalSupply > 0, "Cannot increase 0 supply");

        if (totalSupply == _newTotalSupply) {
            emit TotalSupplyUpdatedHighres(
                totalSupply,
                rebasingCredits_,
                rebasingCreditsPerToken_
            );
            return;
        }

        totalSupply = _newTotalSupply > MAX_SUPPLY
            ? MAX_SUPPLY
            : _newTotalSupply;

        uint256 rebasingSupply = totalSupply - nonRebasingSupply;
        // round up in the favour of the protocol
        rebasingCreditsPerToken_ =
            (rebasingCredits_ * 1e18 + rebasingSupply - 1) /
            rebasingSupply;

        require(rebasingCreditsPerToken_ > 0, "Invalid change in supply");

        emit TotalSupplyUpdatedHighres(
            totalSupply,
            rebasingCredits_,
            rebasingCreditsPerToken_
        );
    }

    /*
     * @notice Send the yield from one account to another account.
     *         Each account keeps its own balances.
     */
    function delegateYield(address _from, address _to)
        external
        onlyGovernorOrStrategist
    {
        require(_from != address(0), "Zero from address not allowed");
        require(_to != address(0), "Zero to address not allowed");

        require(_from != _to, "Cannot delegate to self");
        require(
            yieldFrom[_to] == address(0) &&
                yieldTo[_to] == address(0) &&
                yieldFrom[_from] == address(0) &&
                yieldTo[_from] == address(0),
            "Blocked by existing yield delegation"
        );
        RebaseOptions stateFrom = rebaseState[_from];
        RebaseOptions stateTo = rebaseState[_to];

        require(
            stateFrom == RebaseOptions.NotSet ||
                stateFrom == RebaseOptions.StdNonRebasing ||
                stateFrom == RebaseOptions.StdRebasing,
            "Invalid rebaseState from"
        );

        require(
            stateTo == RebaseOptions.NotSet ||
                stateTo == RebaseOptions.StdNonRebasing ||
                stateTo == RebaseOptions.StdRebasing,
            "Invalid rebaseState to"
        );

        if (alternativeCreditsPerToken[_from] == 0) {
            _rebaseOptOut(_from);
        }
        if (alternativeCreditsPerToken[_to] > 0) {
            _rebaseOptIn(_to);
        }

        uint256 fromBalance = balanceOf(_from);
        uint256 toBalance = balanceOf(_to);
        uint256 oldToCredits = creditBalances[_to];
        uint256 newToCredits = _balanceToRebasingCredits(
            fromBalance + toBalance
        );

        // Set up the bidirectional links
        yieldTo[_from] = _to;
        yieldFrom[_to] = _from;

        // Local
        rebaseState[_from] = RebaseOptions.YieldDelegationSource;
        alternativeCreditsPerToken[_from] = 1e18;
        creditBalances[_from] = fromBalance;
        rebaseState[_to] = RebaseOptions.YieldDelegationTarget;
        creditBalances[_to] = newToCredits;

        // Global
        int256 creditsChange = newToCredits.toInt256() -
            oldToCredits.toInt256();
        _adjustGlobals(creditsChange, -(fromBalance).toInt256());
        emit YieldDelegated(_from, _to);
    }

    /*
     * @notice Stop sending the yield from one account to another account.
     */
    function undelegateYield(address _from) external onlyGovernorOrStrategist {
        // Require a delegation, which will also ensure a valid delegation
        require(yieldTo[_from] != address(0), "Zero address not allowed");

        address to = yieldTo[_from];
        uint256 fromBalance = balanceOf(_from);
        uint256 toBalance = balanceOf(to);
        uint256 oldToCredits = creditBalances[to];
        uint256 newToCredits = _balanceToRebasingCredits(toBalance);

        // Remove the bidirectional links
        yieldFrom[to] = address(0);
        yieldTo[_from] = address(0);

        // Local
        rebaseState[_from] = RebaseOptions.StdNonRebasing;
        // alternativeCreditsPerToken[from] already 1e18 from `delegateYield()`
        creditBalances[_from] = fromBalance;
        rebaseState[to] = RebaseOptions.StdRebasing;
        // alternativeCreditsPerToken[to] already 0 from `delegateYield()`
        creditBalances[to] = newToCredits;

        // Global
        int256 creditsChange = newToCredits.toInt256() -
            oldToCredits.toInt256();
        _adjustGlobals(creditsChange, fromBalance.toInt256());
        emit YieldUndelegated(_from, to);
    }
}
