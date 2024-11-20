// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OUSD Token Contract
 * @dev ERC20 compatible contract for OUSD
 * @dev Implements an elastic supply
 * @author Origin Protocol Inc
 */
import { Governable } from "../governance/Governable.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

contract OUSD is Governable {
    using SafeCast for int256;
    using SafeCast for uint256;

    event TotalSupplyUpdatedHighres(
        uint256 totalSupply,
        uint256 rebasingCredits,
        uint256 rebasingCreditsPerToken
    );
    event AccountRebasingEnabled(address account);
    event AccountRebasingDisabled(address account);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
    event YieldDelegated(address source, address target);
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
    uint256 public totalSupply;
    mapping(address => mapping(address => uint256)) private _allowances;
    address public vaultAddress;
    mapping(address => uint256) internal _creditBalances;
    uint256 private _rebasingCredits; // Sum of all rebasing credits (_creditBalances for rebasing accounts)
    uint256 private _rebasingCreditsPerToken;
    uint256 public nonRebasingSupply; // All nonrebasing balances
    mapping(address => uint256) internal alternativeCreditsPerToken;
    mapping(address => RebaseOptions) public rebaseState;
    mapping(address => uint256) private __deprecated_isUpgraded;
    mapping(address => address) public yieldTo;
    mapping(address => address) public yieldFrom;

    uint256 private constant RESOLUTION_INCREASE = 1e9;
    uint256[38] private __gap; // including below gap totals up to 200

    function initialize(address _vaultAddress, uint256 _initialCreditsPerToken)
        external
        onlyGovernor
    {
        require(_vaultAddress != address(0), "Zero vault address");
        require(vaultAddress == address(0), "Already initialized");

        _rebasingCreditsPerToken = _initialCreditsPerToken;
        vaultAddress = _vaultAddress;
    }

    function symbol() external pure virtual returns (string memory) {
        return "OUSD";
    }

    function name() external pure virtual returns (string memory) {
        return "Origin Dollar";
    }

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
        return _rebasingCreditsPerToken;
    }

    /**
     * @return Low resolution rebasingCreditsPerToken
     */
    function rebasingCreditsPerToken() external view returns (uint256) {
        return _rebasingCreditsPerToken / RESOLUTION_INCREASE;
    }

    /**
     * @return High resolution total number of rebasing credits
     */
    function rebasingCreditsHighres() external view returns (uint256) {
        return _rebasingCredits;
    }

    /**
     * @return Low resolution total number of rebasing credits
     */
    function rebasingCredits() external view returns (uint256) {
        return _rebasingCredits / RESOLUTION_INCREASE;
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
            return _creditBalances[_account];
        }
        uint256 baseBalance = (_creditBalances[_account] * 1e18) /
            _creditsPerToken(_account);
        if (state == RebaseOptions.YieldDelegationTarget) {
            // _creditBalances of yieldFrom accounts equals token balances
            return baseBalance - _creditBalances[yieldFrom[_account]];
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
            return (_creditBalances[_account], cpt);
        } else {
            return (
                _creditBalances[_account] / RESOLUTION_INCREASE,
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
            _creditBalances[_account],
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
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool) {
        require(_to != address(0), "Transfer to zero address");
        require(_value <= _allowances[_from][msg.sender], "Allowance exceeded");

        _allowances[_from][msg.sender] -= _value;
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

    function _adjustAccount(address account, int256 balanceChange)
        internal
        returns (int256 rebasingCreditsDiff, int256 nonRebasingSupplyDiff)
    {
        RebaseOptions state = rebaseState[account];
        int256 currentBalance = balanceOf(account).toInt256();
        if (currentBalance + balanceChange < 0) {
            revert("Transfer amount exceeds balance");
        }
        uint256 newBalance = (currentBalance + balanceChange).toUint256();

        if (state == RebaseOptions.YieldDelegationSource) {
            address target = yieldTo[account];
            uint256 targetOldBalance = balanceOf(target);
            uint256 targetNewCredits = _balanceToRebasingCredits(
                targetOldBalance + newBalance
            );
            rebasingCreditsDiff =
                targetNewCredits.toInt256() -
                _creditBalances[target].toInt256();

            _creditBalances[account] = newBalance;
            _creditBalances[target] = targetNewCredits;
        } else if (state == RebaseOptions.YieldDelegationTarget) {
            uint256 newCredits = _balanceToRebasingCredits(
                newBalance + _creditBalances[yieldFrom[account]]
            );
            rebasingCreditsDiff =
                newCredits.toInt256() -
                _creditBalances[account].toInt256();
            _creditBalances[account] = newCredits;
        } else {
            _autoMigrate(account);
            if (alternativeCreditsPerToken[account] > 0) {
                nonRebasingSupplyDiff = balanceChange;
                alternativeCreditsPerToken[account] = 1e18;
                _creditBalances[account] = newBalance;
            } else {
                uint256 newCredits = _balanceToRebasingCredits(newBalance);
                rebasingCreditsDiff =
                    newCredits.toInt256() -
                    _creditBalances[account].toInt256();
                _creditBalances[account] = newCredits;
            }
        }
    }

    function _adjustGlobals(
        int256 rebasingCreditsDiff,
        int256 nonRebasingSupplyDiff
    ) internal {
        if (rebasingCreditsDiff != 0) {
            _rebasingCredits = (_rebasingCredits.toInt256() +
                rebasingCreditsDiff).toUint256();
        }
        if (nonRebasingSupplyDiff != 0) {
            nonRebasingSupply = (nonRebasingSupply.toInt256() +
                nonRebasingSupplyDiff).toUint256();
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
        return _allowances[_owner][_spender];
    }

    /**
     * @notice Approve the passed address to spend the specified amount of
     *      tokens on behalf of msg.sender.
     * @param _spender The address which will spend the funds.
     * @param _value The amount of tokens to be spent.
     */
    function approve(address _spender, uint256 _value) external returns (bool) {
        _allowances[msg.sender][_spender] = _value;
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
        if (alternativeCreditsPerToken[_account] != 0) {
            return alternativeCreditsPerToken[_account];
        } else {
            return _rebasingCreditsPerToken;
        }
    }

    /**
     * @dev Auto migrate contracts to be non rebasing,
     *     unless they have opted into yield.
     * @param _account Address of the account.
     */
    function _autoMigrate(address _account) internal {
        bool isContract = _account.code.length > 0;
        // In previous code versions, contracts would not have had their
        // rebaseState[_account] set to RebaseOptions.NonRebasing when migrated
        // therefor we check the actual accounting used on the account instead.
        if (
            isContract &&
            rebaseState[_account] == RebaseOptions.NotSet &&
            alternativeCreditsPerToken[_account] == 0
        ) {
            _rebaseOptOut(_account);
        }
    }

    function _balanceToRebasingCredits(uint256 balance)
        internal
        view
        returns (uint256)
    {
        // Rounds up, because we need to ensure that accounts always have
        // at least the balance that they should have.
        // Note this should always be used on an absolute account value,
        // not on a possibly negative diff, because then the rounding would be wrong.
        return ((balance) * _rebasingCreditsPerToken + 1e18 - 1) / 1e18;
    }

    /**
     * @notice Enable rebasing for an account.
     * @param _account Address of the account.
     */
    function governanceRebaseOptIn(address _account) external onlyGovernor {
        _rebaseOptIn(_account);
    }

    /**
     * @notice The calling account will start receiving yield after a successful call.
     */
    function rebaseOptIn() external {
        _rebaseOptIn(msg.sender);
    }

    function _rebaseOptIn(address _account) internal {
        // prettier-ignore
        require(
            alternativeCreditsPerToken[_account] > 0 ||
                // Accounts may explicitly `rebaseOptIn` regardless of
                // accounting if they have a 0 balance.
                balanceOf(_account) == 0
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

        uint256 balance = balanceOf(_account);

        // Account
        rebaseState[_account] = RebaseOptions.StdRebasing;
        alternativeCreditsPerToken[_account] = 0;
        _creditBalances[_account] = _balanceToRebasingCredits(balance);
        // Globals
        _adjustGlobals(_creditBalances[_account].toInt256(), -balance.toInt256());

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

        uint256 oldCredits = _creditBalances[_account];
        uint256 balance = balanceOf(_account);

        // Account
        rebaseState[_account] = RebaseOptions.StdNonRebasing;
        alternativeCreditsPerToken[_account] = 1e18;
        _creditBalances[_account] = balance;
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
                _rebasingCredits,
                _rebasingCreditsPerToken
            );
            return;
        }

        totalSupply = _newTotalSupply > MAX_SUPPLY
            ? MAX_SUPPLY
            : _newTotalSupply;

        _rebasingCreditsPerToken =
            (_rebasingCredits * 1e18) /
            (totalSupply - nonRebasingSupply);

        require(_rebasingCreditsPerToken > 0, "Invalid change in supply");

        emit TotalSupplyUpdatedHighres(
            totalSupply,
            _rebasingCredits,
            _rebasingCreditsPerToken
        );
    }

    /*
     * @notice Send the yield from one account to another account.
     *     Each account keeps their own balances.
     */
    function delegateYield(address from, address to) external onlyGovernor {
        require(from != address(0), "Zero from address not allowed");
        require(to != address(0), "Zero to address not allowed");

        require(from != to, "Cannot delegate to self");
        require(
            yieldFrom[to] == address(0) &&
                yieldTo[to] == address(0) &&
                yieldFrom[from] == address(0) &&
                yieldTo[from] == address(0),
            "Blocked by existing yield delegation"
        );
        RebaseOptions stateFrom = rebaseState[from];
        RebaseOptions stateTo = rebaseState[to];

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

        if (alternativeCreditsPerToken[from] == 0) {
            _rebaseOptOut(from);
        }
        if (alternativeCreditsPerToken[to] > 0) {
            _rebaseOptIn(to);
        }

        uint256 fromBalance = balanceOf(from);
        uint256 creditsFrom = _balanceToRebasingCredits(fromBalance);

        // Set up the bidirectional links
        yieldTo[from] = to;
        yieldFrom[to] = from;
        rebaseState[from] = RebaseOptions.YieldDelegationSource;
        rebaseState[to] = RebaseOptions.YieldDelegationTarget;

        // Local
        _creditBalances[from] = fromBalance;
        alternativeCreditsPerToken[from] = 1e18;
        _creditBalances[to] += creditsFrom;
        // Global
        _adjustGlobals(creditsFrom.toInt256(), -fromBalance.toInt256());

        emit YieldDelegated(from, to);
    }

    /*
     * @notice Stop sending the yield from one account to another account.
     */
    function undelegateYield(address from) external onlyGovernor {
        // Require a delegation, which will also ensure a valid delegation
        require(yieldTo[from] != address(0), "Zero address not allowed");

        address to = yieldTo[from];
        uint256 fromBalance = balanceOf(from);
        // these are credits of from account if it were rebasing
        uint256 creditsFrom = _balanceToRebasingCredits(fromBalance);

        // Remove the bidirectional links
        yieldFrom[to] = address(0);
        yieldTo[from] = address(0);
        rebaseState[from] = RebaseOptions.StdNonRebasing;
        rebaseState[to] = RebaseOptions.StdRebasing;

        // Local
        // alternativeCreditsPerToken[from] already 1e18 from `delegateYield()`
        _creditBalances[from] = fromBalance;
        // alternativeCreditsPerToken[to] already 0 from `delegateYield()`
        _creditBalances[to] -= creditsFrom;
        // Global
        _adjustGlobals(-(creditsFrom).toInt256(), fromBalance.toInt256());

        emit YieldUndelegated(from, to);
    }
}
