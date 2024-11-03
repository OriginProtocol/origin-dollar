// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OUSD Token Contract
 * @dev ERC20 compatible contract for OUSD
 * @dev Implements an elastic supply
 * @author Origin Protocol Inc
 */
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";

import { Initializable } from "../utils/Initializable.sol";
import { InitializableERC20Detailed } from "../utils/InitializableERC20Detailed.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Governable } from "../governance/Governable.sol";

/**
 * NOTE that this is an ERC20 token but the invariant that the sum of
 * balanceOf(x) for all x is not >= totalSupply(). This is a consequence of the
 * rebasing design. Any integrations with OUSD should be aware.
 */

contract OUSD is Initializable, InitializableERC20Detailed, Governable {
    using SafeMath for uint256;
    using StableMath for uint256;

    event TotalSupplyUpdatedHighres(
        uint256 totalSupply,
        uint256 rebasingCredits,
        uint256 rebasingCreditsPerToken
    );
    event AccountRebasingEnabled(address account);
    event AccountRebasingDisabled(address account);
    event YieldDelegationStart(address fromAccount, address toAccount, uint256 rebasingCreditsPerToken);
    event YieldDelegationStop(address fromAccount, address toAccount, uint256 rebasingCreditsPerToken);

    enum RebaseOptions {
        NotSet,
        OptOut,
        OptIn
    }

    uint256 private constant MAX_SUPPLY = ~uint128(0); // (2^128) - 1
    uint256 public _totalSupply;
    mapping(address => mapping(address => uint256)) private _allowances;
    address public vaultAddress = address(0);
    mapping(address => uint256) private _creditBalances;
    uint256 private _rebasingCredits;
    uint256 private _rebasingCreditsPerToken;
    // Frozen address/credits are non rebasing (value is held in contracts which
    // do not receive yield unless they explicitly opt in)
    uint256 public nonRebasingSupply;
    mapping(address => uint256) public nonRebasingCreditsPerToken;
    mapping(address => RebaseOptions) public rebaseState;
    mapping(address => uint256) public isUpgraded;
    /**
     * The delegatedRebases contains a mapping of: 
     * rebaseSource => [rebaseReceiver, creditsPerToken]
     * 
     * This is all the additional storage logic required to track the balances when
     * the rebaseSource wants to delegate its yield to a rebaseReceiver. We do this
     * using the following principle: 
     * - a yield delegation account freezes its own. It copies the global creditsPerToken to a 
     *   nonRebasingCreditsPerToken mapping indicating its own balance doesn't rebase any longer.
     * - an entry is added to delegatedRebases:
     *   `delegatedRebases[rebaseSource] = [rebaseReceiver, _rebasingCreditsPerToken]
     *   indicating the beginning of yield collection to a delegated account. The difference
     *   in current global contract `_rebasingCreditsPerToken` and the credits per token
     *   stored in the delegatedRebases marks all the yield accrued that has been delegating.
     *   This way a global rebase an O(1) action manages to update the rebasing tokens and
     *   the delegated rebase tokens. Without any other storage slot changes while rebasing.
     * - IMPORTANT (!) this mapping is valid only as long as the `_creditBalances[rebaseSource]`
     *   doesn't change. If transfer in/out happens the `Yield accounting Action` is triggered.
     * - There are 4 types of Transfer functions to consider: 
     *   -> Transfer TO rebaseSource
     *      Transfer changes the amount of source credits that are rebasing to a receiverAccount.
     *      Yield accounting action triggered
     *   -> Transfer FROM rebaseSource
     *      Transfer changes the amount of source credits that are rebasing to a receiverAccount.
     *      Yield accounting action triggered
     *   -> Transfer TO rebaseReceiver
     *      The delegated credits need not be touched here. We just update the internal credits
     *      of the rebaseReceiver
     *   -> Transfer FROM rebaseReceiver
     *      Receiver has credits from 2 sources in the contract:
     *        1. delegated yield
     *        2. its own internal credits
     *      Its own internal credits might not be enough to facilitate the transfer.
     *      Yield accounting action triggered
     * 
     *   Yield accounting Action
     *     When a transfer from/to rebaseSource or transfer from rebaseReceiver happens all the 
     *     delegated yield accruing in the `delegatedRebases` is materialized to 
     *     _creditBalances[rebaseReceiver]. The delegatedRebases[rebaseSource]'s
     *     creditsPerToken are updated to the latest global contract value.
     *     In other words yield of an account represented by the delegation mapping is moved
     *     to the receiver's creditBalances.
     * 
     * LIMITATIONS: 
     *  - rebaseSource can delegate yield to only one rebaseReceiver
     *  - rebaseReceiver can only have yield delegated from one rebaseSource
     * 
     */
    mapping(address => RebaseDelegationData) private delegatedRebases;
    /**
     * The delegatedRebasesReversed is just the mapping in the other direction for purposes
     * of data access. Any update to delegatedRebases needs to also reflect a change in 
     * delegatedRebasesReversed.
     * 
     * rebaseReceiver => [rebaseSource, creditsPerToken]
     */
    mapping(address => RebaseDelegationData) private delegatedRebasesReversed;

    uint256 private constant RESOLUTION_INCREASE = 1e9;

    struct RebaseDelegationData {
        address account; // can be either rebaseSource or rebaseReceiver
        uint256 delegationStartCreditsPerToken;
    }

    function initialize(
        string calldata _nameArg,
        string calldata _symbolArg,
        address _vaultAddress,
        uint256 _initialCreditsPerToken
    ) external onlyGovernor initializer {
        InitializableERC20Detailed._initialize(_nameArg, _symbolArg, 18);
        _rebasingCreditsPerToken = _initialCreditsPerToken;
        vaultAddress = _vaultAddress;
    }

    /**
     * @dev Verifies that the caller is the Vault contract
     */
    modifier onlyVault() {
        require(vaultAddress == msg.sender, "Caller is not the Vault");
        _;
    }

    /**
     * @return The total supply of OUSD.
     */
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @return Low resolution rebasingCreditsPerToken
     */
    function rebasingCreditsPerToken() public view returns (uint256) {
        return _rebasingCreditsPerToken / RESOLUTION_INCREASE;
    }

    /**
     * @return Low resolution total number of rebasing credits
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

    /**
     * @dev Gets the balance of the specified address.
     * @param _account Address to query the balance of.
     * @return A uint256 representing the amount of base units owned by the
     *         specified address.
     */
    function balanceOf(address _account)
        public
        view
        override
        returns (uint256)
    {
        uint256 rebaseDelegatedValue = 0;
        if (_hasRebaseDelegatedTo(_account)) {
            rebaseDelegatedValue = _balanceOfRebaseDelegated(_account);
        }

        if (_creditBalances[_account] == 0) return rebaseDelegatedValue;
        return
            _creditBalances[_account].divPrecisely(_creditsPerToken(_account)) + rebaseDelegatedValue;
    }

    /**
     * @dev Gets the credits balance of the specified address.
     * @dev Backwards compatible with old low res credits per token.
     * @param _account The address to query the balance of.
     * @return (uint256, uint256) Credit balance and credits per token of the
     *         address
     */
    function creditsBalanceOf(address _account)
        public
        view
        returns (uint256, uint256)
    {
        // TODO make it work with rebase delegated
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
     * @dev Gets the credits balance of the specified address.
     * @param _account The address to query the balance of.
     * @return (uint256, uint256, bool) Credit balance, credits per token of the
     *         address, and isUpgraded
     */
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
     * @dev Transfer tokens to a specified address.
     * @param _to the address to transfer to.
     * @param _value the amount to be transferred.
     * @return true on success.
     */
    function transfer(address _to, uint256 _value)
        public
        override
        returns (bool)
    {
        require(_to != address(0), "Transfer to zero address");
        require(
            _value <= balanceOf(msg.sender),
            "Transfer greater than balance"
        );

        _executeTransfer(msg.sender, _to, _value);

        emit Transfer(msg.sender, _to, _value);

        return true;
    }

    /**
     * @dev Transfer tokens from one address to another.
     * @param _from The address you want to send tokens from.
     * @param _to The address you want to transfer to.
     * @param _value The amount of tokens to be transferred.
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public override returns (bool) {
        require(_to != address(0), "Transfer to zero address");
        require(_value <= balanceOf(_from), "Transfer greater than balance");

        _allowances[_from][msg.sender] = _allowances[_from][msg.sender].sub(
            _value
        );

        _executeTransfer(_from, _to, _value);

        emit Transfer(_from, _to, _value);

        return true;
    }

    /**
     * @dev Update the count of non rebasing credits in response to a transfer
     * @param _from The address you want to send tokens from.
     * @param _to The address you want to transfer to.
     * @param _value Amount of OUSD to transfer
     */
    function _executeTransfer(
        address _from,
        address _to,
        uint256 _value
    ) internal {
        bool isNonRebasingTo = _isNonRebasingAccount(_to);
        bool isNonRebasingFrom = _isNonRebasingAccount(_from);
        
        _onBeforeTokenCredited(_to);
        _onBeforeTokenDeducted(_from);

        // Credits deducted and credited might be different due to the
        // differing creditsPerToken used by each account
        uint256 creditsCredited = _value.mulTruncate(_creditsPerToken(_to));
        uint256 creditsDeducted = _value.mulTruncate(_creditsPerToken(_from));

        _creditBalances[_from] = _creditBalances[_from].sub(
            creditsDeducted,
            "Transfer amount exceeds balance"
        );
        _creditBalances[_to] = _creditBalances[_to].add(creditsCredited);

        if (isNonRebasingTo && !isNonRebasingFrom) {
            // Transfer to non-rebasing account from rebasing account, credits
            // are removed from the non rebasing tally
            nonRebasingSupply = nonRebasingSupply.add(_value);
            // Update rebasingCredits by subtracting the deducted amount
            _rebasingCredits = _rebasingCredits.sub(creditsDeducted);
        } else if (!isNonRebasingTo && isNonRebasingFrom) {
            // Transfer to rebasing account from non-rebasing account
            // Decreasing non-rebasing credits by the amount that was sent
            nonRebasingSupply = nonRebasingSupply.sub(_value);
            // Update rebasingCredits by adding the credited amount
            _rebasingCredits = _rebasingCredits.add(creditsCredited);
        }
    }

    // before token is going to be credited to internal credits of an account
    function _onBeforeTokenCredited(address _receiver) internal {
        if (_delegatesRebase(_receiver)) {
           _delegatedRebaseAccountingBySource(_receiver);
        }
    }

    // before token is going to be deducted from internal credits of an account
    function _onBeforeTokenDeducted(address _sender) internal {
        if (_delegatesRebase(_sender)) {
            _delegatedRebaseAccountingBySource(_sender);
        }
        else if (_hasRebaseDelegatedTo(_sender)) {
            _delegatedRebaseAccountingByReceiver(_sender);
        }
    }

    /**
     * @dev Function to check the amount of tokens that _owner has allowed to
     *      `_spender`.
     * @param _owner The address which owns the funds.
     * @param _spender The address which will spend the funds.
     * @return The number of tokens still available for the _spender.
     */
    function allowance(address _owner, address _spender)
        public
        view
        override
        returns (uint256)
    {
        return _allowances[_owner][_spender];
    }

    /**
     * @dev Approve the passed address to spend the specified amount of tokens
     *      on behalf of msg.sender. This method is included for ERC20
     *      compatibility. `increaseAllowance` and `decreaseAllowance` should be
     *      used instead.
     *
     *      Changing an allowance with this method brings the risk that someone
     *      may transfer both the old and the new allowance - if they are both
     *      greater than zero - if a transfer transaction is mined before the
     *      later approve() call is mined.
     * @param _spender The address which will spend the funds.
     * @param _value The amount of tokens to be spent.
     */
    function approve(address _spender, uint256 _value)
        public
        override
        returns (bool)
    {
        _allowances[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    /**
     * @dev Increase the amount of tokens that an owner has allowed to
     *      `_spender`.
     *      This method should be used instead of approve() to avoid the double
     *      approval vulnerability described above.
     * @param _spender The address which will spend the funds.
     * @param _addedValue The amount of tokens to increase the allowance by.
     */
    function increaseAllowance(address _spender, uint256 _addedValue)
        public
        returns (bool)
    {
        _allowances[msg.sender][_spender] = _allowances[msg.sender][_spender]
            .add(_addedValue);
        emit Approval(msg.sender, _spender, _allowances[msg.sender][_spender]);
        return true;
    }

    /**
     * @dev Decrease the amount of tokens that an owner has allowed to
            `_spender`.
     * @param _spender The address which will spend the funds.
     * @param _subtractedValue The amount of tokens to decrease the allowance
     *        by.
     */
    function decreaseAllowance(address _spender, uint256 _subtractedValue)
        public
        returns (bool)
    {
        uint256 oldValue = _allowances[msg.sender][_spender];
        if (_subtractedValue >= oldValue) {
            _allowances[msg.sender][_spender] = 0;
        } else {
            _allowances[msg.sender][_spender] = oldValue.sub(_subtractedValue);
        }
        emit Approval(msg.sender, _spender, _allowances[msg.sender][_spender]);
        return true;
    }

    /**
     * @dev Mints new tokens, increasing totalSupply.
     */
    function mint(address _account, uint256 _amount) external onlyVault {
        _mint(_account, _amount);
    }

    /**
     * @dev Creates `_amount` tokens and assigns them to `_account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements
     *
     * - `to` cannot be the zero address.
     */
    function _mint(address _account, uint256 _amount) internal nonReentrant {
        require(_account != address(0), "Mint to the zero address");

        bool isNonRebasingAccount = _isNonRebasingAccount(_account);

        _onBeforeTokenCredited(_account);
        uint256 creditAmount = _amount.mulTruncate(_creditsPerToken(_account));
        _creditBalances[_account] = _creditBalances[_account].add(creditAmount);

        // If the account is non rebasing and doesn't have a set creditsPerToken
        // then set it i.e. this is a mint from a fresh contract
        if (isNonRebasingAccount) {
            nonRebasingSupply = nonRebasingSupply.add(_amount);
        } else {
            _rebasingCredits = _rebasingCredits.add(creditAmount);
        }

        _totalSupply = _totalSupply.add(_amount);

        require(_totalSupply < MAX_SUPPLY, "Max supply");

        emit Transfer(address(0), _account, _amount);
    }

    /**
     * @dev Burns tokens, decreasing totalSupply.
     */
    function burn(address account, uint256 amount) external onlyVault {
        _burn(account, amount);
    }

    /**
     * @dev Destroys `_amount` tokens from `_account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements
     *
     * - `_account` cannot be the zero address.
     * - `_account` must have at least `_amount` tokens.
     */
    function _burn(address _account, uint256 _amount) internal nonReentrant {
        require(_account != address(0), "Burn from the zero address");
        if (_amount == 0) {
            return;
        }

        _onBeforeTokenDeducted(_account);
        bool isNonRebasingAccount = _isNonRebasingAccount(_account);
        uint256 creditAmount = _amount.mulTruncate(_creditsPerToken(_account));
        uint256 currentCredits = _creditBalances[_account];

        // Remove the credits, burning rounding errors
        if (
            currentCredits == creditAmount || currentCredits - 1 == creditAmount
        ) {
            // Handle dust from rounding
            _creditBalances[_account] = 0;
        } else if (currentCredits > creditAmount) {
            _creditBalances[_account] = _creditBalances[_account].sub(
                creditAmount
            );
        } else {
            revert("Remove exceeds balance");
        }

        // Remove from the credit tallies and non-rebasing supply
        if (isNonRebasingAccount) {
            nonRebasingSupply = nonRebasingSupply.sub(_amount);
        } else {
            _rebasingCredits = _rebasingCredits.sub(creditAmount);
        }

        _totalSupply = _totalSupply.sub(_amount);

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
        if (nonRebasingCreditsPerToken[_account] != 0) {
            return nonRebasingCreditsPerToken[_account];
        } else {
            return _rebasingCreditsPerToken;
        }
    }

    /**
     * @dev Is an account using rebasing accounting or non-rebasing accounting?
     *      Also, ensure contracts are non-rebasing if they have not opted in.
     * @param _account Address of the account.
     */
    function _isNonRebasingAccount(address _account) internal returns (bool) {
        bool isContract = Address.isContract(_account);
        if (isContract && rebaseState[_account] == RebaseOptions.NotSet) {
            _ensureRebasingMigration(_account);
        }
        // nonRebasingCreditsPerToken that are part of yield delegation are not considered nonRebasingAccounts
        return nonRebasingCreditsPerToken[_account] > 0 && delegatedRebases[_account].account == address(0);
    }

    /**
     * @dev Ensures internal account for rebasing and non-rebasing credits and
     *      supply is updated following deployment of frozen yield change.
     */
    function _ensureRebasingMigration(address _account) internal {
        if (nonRebasingCreditsPerToken[_account] == 0) {
            emit AccountRebasingDisabled(_account);
            if (_creditBalances[_account] == 0) {
                // Since there is no existing balance, we can directly set to
                // high resolution, and do not have to do any other bookkeeping
                nonRebasingCreditsPerToken[_account] = 1e27;
            } else {
                // Migrate an existing account:

                // Set fixed credits per token for this account
                nonRebasingCreditsPerToken[_account] = _rebasingCreditsPerToken;
                // Update non rebasing supply
                nonRebasingSupply = nonRebasingSupply.add(balanceOf(_account));
                // Update credit tallies
                _rebasingCredits = _rebasingCredits.sub(
                    _creditBalances[_account]
                );
            }
        }
    }

    /**
     * @notice Enable rebasing for an account.
     * @dev Add a contract address to the non-rebasing exception list. The
     * address's balance will be part of rebases and the account will be exposed
     * to upside and downside.
     * @param _account Address of the account.
     */
    function governanceRebaseOptIn(address _account)
        public
        nonReentrant
        onlyGovernor
    {
        _rebaseOptIn(_account);
    }

    /**
     * @dev Add a contract address to the non-rebasing exception list. The
     * address's balance will be part of rebases and the account will be exposed
     * to upside and downside.
     */
    function rebaseOptIn() public nonReentrant {
        _rebaseOptIn(msg.sender);
    }

    function _rebaseOptIn(address _account) internal {
        require(_isNonRebasingAccount(_account), "Account has not opted out");

        // Convert balance into the same amount at the current exchange rate
        uint256 newCreditBalance = _creditBalances[_account]
            .mul(_rebasingCreditsPerToken)
            .div(_creditsPerToken(_account));

        // Decreasing non rebasing supply
        nonRebasingSupply = nonRebasingSupply.sub(balanceOf(_account));

        _creditBalances[_account] = newCreditBalance;

        // Increase rebasing credits, totalSupply remains unchanged so no
        // adjustment necessary
        _rebasingCredits = _rebasingCredits.add(_creditBalances[_account]);

        rebaseState[_account] = RebaseOptions.OptIn;

        // Delete any fixed credits per token
        delete nonRebasingCreditsPerToken[_account];
        emit AccountRebasingEnabled(_account);
    }

    /**
     * @dev Explicitly mark that an address is non-rebasing.
     */
    function rebaseOptOut() public nonReentrant {
        require(!_isNonRebasingAccount(msg.sender), "Account has not opted in");

        // Increase non rebasing supply
        nonRebasingSupply = nonRebasingSupply.add(balanceOf(msg.sender));
        // Set fixed credits per token
        nonRebasingCreditsPerToken[msg.sender] = _rebasingCreditsPerToken;

        // Decrease rebasing credits, total supply remains unchanged so no
        // adjustment necessary
        _rebasingCredits = _rebasingCredits.sub(_creditBalances[msg.sender]);

        // Mark explicitly opted out of rebasing
        rebaseState[msg.sender] = RebaseOptions.OptOut;
        emit AccountRebasingDisabled(msg.sender);
    }

    function governanceDelegateYield(address _accountSource, address _accountReceiver)
        public
        onlyGovernor
    {
        if (rebaseState[_accountSource] == RebaseOptions.OptOut) {
            _rebaseOptIn(_accountSource);
        } else if (rebaseState[_accountSource] == RebaseOptions.NotSet) {
            rebaseState[_accountSource] == RebaseOptions.OptIn;
        }

        _resetYieldDelegation(_accountSource, _accountReceiver);
        nonRebasingCreditsPerToken[_accountSource] = _rebasingCreditsPerToken;

        emit YieldDelegationStart(_accountSource, _accountReceiver, _rebasingCreditsPerToken);
    }

    function governanceStopYieldDelegation(address _accountSource)
        public
        onlyGovernor
    {
        RebaseDelegationData memory delegationData = delegatedRebases[_accountSource];
        require(delegationData.account != address(0), "No entry found");

        _delegatedRebaseAccounting(_accountSource, delegationData.account, delegationData.delegationStartCreditsPerToken);
        delete delegatedRebases[_accountSource];
        delete delegatedRebasesReversed[delegationData.account];
        nonRebasingCreditsPerToken[_accountSource] = 0;

        emit YieldDelegationStart(_accountSource, delegationData.account, _rebasingCreditsPerToken);
    }

    /**
     * @dev adds or updates a yield delegation mapping and resets the `delegationStartCreditsPerToken` to a 
     * recent rebasing credits per token. The latter reset action nullifies any accrued yield since the accrued
     * yield increases by the growing difference between contract's global _rebasingCreditsPerToken and 
     * and the one stored in the mapping.
     */
    function _resetYieldDelegation(address _accountSource, address _accountReceiver) internal {
        delegatedRebases[_accountSource] = RebaseDelegationData({
            account: _accountReceiver,
            delegationStartCreditsPerToken: _rebasingCreditsPerToken
        });

        delegatedRebasesReversed[_accountReceiver] = RebaseDelegationData({
            account: _accountSource,
            delegationStartCreditsPerToken: _rebasingCreditsPerToken 
        });
    }

    // moves funds from delegatedRebases to creditBalances
    function _delegatedRebaseAccountingBySource(address _accountSource) internal {
        RebaseDelegationData memory delegationData = delegatedRebases[_accountSource];

        // receiver has no pending rebases to account for
        if (delegationData.delegationStartCreditsPerToken == _rebasingCreditsPerToken) {
            return;
        }
        _delegatedRebaseAccounting(_accountSource, delegationData.account, delegationData.delegationStartCreditsPerToken);
    }

    // moves funds from delegatedRebases to creditBalances
    function _delegatedRebaseAccountingByReceiver(address _accountReceiver) internal {
        RebaseDelegationData memory delegationData = delegatedRebasesReversed[_accountReceiver];
        // receiver has no pending rebases to account for
        if (delegationData.delegationStartCreditsPerToken == _rebasingCreditsPerToken) {
            return;
        }
        _delegatedRebaseAccounting(delegationData.account, _accountReceiver, delegationData.delegationStartCreditsPerToken);
    }

    function _delegatedRebaseAccounting(
        address _accountSource,
        address _accountReceiver,
        uint256 _delegationStartCreditsPerToken
    ) internal {
        // TODO: possible to support non rebasing as well
        // TODO probably delete this part
        require(rebaseState[_accountReceiver] == RebaseOptions.OptIn ||
            rebaseState[_accountReceiver] == RebaseOptions.NotSet, "Account Receiver needs to support rebasing");

        
        _creditBalances[_accountReceiver] += _balanceOfRebaseDelegated(_accountSource, _delegationStartCreditsPerToken)
            .mulTruncate(_rebasingCreditsPerToken);
        _resetYieldDelegation(_accountSource, _accountReceiver);
    }

        
    function _balanceOfRebaseDelegated(address _accountReceiver) internal view returns (uint256){
        RebaseDelegationData memory delegationData = delegatedRebasesReversed[_accountReceiver];
        return _balanceOfRebaseDelegated(delegationData.account, delegationData.delegationStartCreditsPerToken);
    }

    function _balanceOfRebaseDelegated(address _accountSource, uint256 _delegationStartCreditsPerToken) internal view returns (uint256){
        return _creditBalances[_accountSource].divPrecisely(_rebasingCreditsPerToken) - 
            _creditBalances[_accountSource].divPrecisely(_delegationStartCreditsPerToken);
    }

    // does account have a rebase delegated to itself?
    function _hasRebaseDelegatedTo(address account) internal view returns (bool){
        return delegatedRebasesReversed[account].delegationStartCreditsPerToken > 0;
    }

    // does account have delegate rebase?
    function _delegatesRebase(address account) internal view returns (bool){
        return delegatedRebases[account].delegationStartCreditsPerToken > 0;
    }

    /**
     * @dev Modify the supply without minting new tokens. This uses a change in
     *      the exchange rate between "credits" and OUSD tokens to change balances.
     * @param _newTotalSupply New total supply of OUSD.
     */
    function changeSupply(uint256 _newTotalSupply)
        external
        onlyVault
        nonReentrant
    {
        require(_totalSupply > 0, "Cannot increase 0 supply");

        if (_totalSupply == _newTotalSupply) {
            emit TotalSupplyUpdatedHighres(
                _totalSupply,
                _rebasingCredits,
                _rebasingCreditsPerToken
            );
            return;
        }

        _totalSupply = _newTotalSupply > MAX_SUPPLY
            ? MAX_SUPPLY
            : _newTotalSupply;

        _rebasingCreditsPerToken = _rebasingCredits.divPrecisely(
            _totalSupply.sub(nonRebasingSupply)
        );

        require(_rebasingCreditsPerToken > 0, "Invalid change in supply");

        _totalSupply = _rebasingCredits
            .divPrecisely(_rebasingCreditsPerToken)
            .add(nonRebasingSupply);

        emit TotalSupplyUpdatedHighres(
            _totalSupply,
            _rebasingCredits,
            _rebasingCreditsPerToken
        );
    }
}
