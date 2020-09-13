pragma solidity 0.5.11;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
// prettier-ignore
import { Initializable } from "@openzeppelin/upgrades/contracts/Initializable.sol";

import { InitializableToken } from "../utils/InitializableToken.sol";
import "../utils/StableMath.sol";

contract OUSD is Initializable, InitializableToken {
    using SafeMath for uint256;
    using StableMath for uint256;

    event TotalSupplyUpdated(uint256 totalSupply);

    uint256 private constant MAX_SUPPLY = ~uint128(0); // (2^128) - 1

    uint256 private _totalSupply;
    uint256 private totalCredits;
    // Exchange rate between internal credits and OUSD
    uint256 private creditsPerToken;

    mapping(address => uint256) private _creditBalances;

    // Allowances denominated in OUSD
    mapping(address => mapping(address => uint256)) private _allowances;

    // Frozen address/credits are non rebasing (value is held in contracts which
    // do not receive yield unless they explicitly opt in)
    uint256 private nonRebasingCredits;
    uint256 private nonRebasingSupply;
    mapping(address => uint256) private nonRebasingCreditsPerToken;
    mapping(address => bool) private rebaseOptInList;

    address vaultAddress;

    function initialize(
        string calldata _nameArg,
        string calldata _symbolArg,
        address _vaultAddress
    ) external initializer {
        InitializableToken._initialize(_nameArg, _symbolArg);

        _totalSupply = 0;
        totalCredits = 0;
        nonRebasingSupply = 0;
        creditsPerToken = 1e18;

        vaultAddress = _vaultAddress;
    }

    /**
     * @dev Verifies that the caller is the Savings Manager contract
     */
    modifier onlyVault() {
        require(vaultAddress == msg.sender, "Caller is not the Vault");
        _;
    }

    /**
     * @return The total supply of OUSD.
     */
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev Gets the balance of the specified address.
     * @param _account The address to query the balance of.
     * @return A unit256 representing the _amount of base units owned by the
     *         specified address.
     */
    function balanceOf(address _account) public view returns (uint256) {
        if (creditsPerToken == 0) return 0;
        return
            _creditBalances[_account].divPrecisely(_creditsPerToken(_account));
    }

    /**
     * @dev Transfer tokens to a specified address.
     * @param _to the address to transfer to.
     * @param _value the _amount to be transferred.
     * @return true on success.
     */
    function transfer(address _to, uint256 _value) public returns (bool) {
        _executeTransfer(msg.sender, _to, _value);

        emit Transfer(msg.sender, _to, _value);

        return true;
    }

    /**
     * @dev Transfer tokens from one address to another.
     * @param _from The address you want to send tokens from.
     * @param _to The address you want to transfer to.
     * @param _value The _amount of tokens to be transferred.
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public returns (bool) {
        _allowances[_from][msg.sender] = _allowances[_from][msg.sender].sub(
            _value
        );

        _executeTransfer(_from, _to, _value);

        emit Transfer(_from, _to, _value);

        return true;
    }

    /**
     * @notice Update the count of non rebasing credits in response to a transfer
     * @param _from The address you want to send tokens from.
     * @param _to The address you want to transfer to.
     * @param _value Amount of OUSD to transfer
     */
    function _executeTransfer(
        address _from,
        address _to,
        uint256 _value
    ) internal {
        // Credits deducted and credited might be different due to the
        // differing creditsPerToken used by each account
        uint256 creditsDeducted = _value.mulTruncate(_creditsPerToken(_from));
        uint256 creditsCredited = _value.mulTruncate(_creditsPerToken(_to));

        _creditBalances[_from] = _creditBalances[_from].sub(creditsDeducted);
        _creditBalances[_to] = _creditBalances[_to].add(creditsCredited);

        bool isNonRebasingTo = _isNonRebasingAddress(_to);
        bool isNonRebasingFrom = _isNonRebasingAddress(_from);

        if (isNonRebasingTo && !isNonRebasingFrom) {
            // Transfer to non-rebasing account from rebasing account, credits
            // are removed from the non rebasing tally
            nonRebasingCredits += creditsCredited;
            nonRebasingSupply += _value;
        } else if (!isNonRebasingTo && isNonRebasingFrom) {
            // Transfer to rebasing account from non-rebasing account
            // Decreasing non-rebasing credits by the amount that was sent
            nonRebasingCredits -= creditsDeducted;
            nonRebasingSupply -= _value;
            delete nonRebasingCreditsPerToken[_to];
        } else if (isNonRebasingTo && isNonRebasingFrom) {
            // Transfer between two non rebasing accounts. They may have
            // different exchange rates so update the count of non rebasing
            // credits with the difference
            nonRebasingCredits += creditsCredited - creditsDeducted;
        }

        // Make sure the fixed credits per token get set for to/from accounts if
        // they have not been
        if (isNonRebasingTo && nonRebasingCreditsPerToken[_to] == 0) {
            nonRebasingCreditsPerToken[_to] = creditsPerToken;
        }
        if (isNonRebasingFrom && nonRebasingCreditsPerToken[_from] == 0) {
            nonRebasingCreditsPerToken[_to] = creditsPerToken;
        }

        // Total credits can change when transferring between the amount of
        // credits can change when transferring between rebasing and non-rebasing
        // accounts
        totalCredits += creditsCredited - creditsDeducted;
    }

    /**
     * @dev Function to check the _amount of tokens that an owner has allowed to a _spender.
     * @param _owner The address which owns the funds.
     * @param _spender The address which will spend the funds.
     * @return The number of tokens still available for the _spender.
     */
    function allowance(address _owner, address _spender)
        public
        view
        returns (uint256)
    {
        return _allowances[_owner][_spender];
    }

    /**
     * @dev Approve the passed address to spend the specified _amount of tokens on behalf of
     * msg.sender. This method is included for ERC20 compatibility.
     * increaseAllowance and decreaseAllowance should be used instead.
     * Changing an allowance with this method brings the risk that someone may transfer both
     * the old and the new allowance - if they are both greater than zero - if a transfer
     * transaction is mined before the later approve() call is mined.
     *
     * @param _spender The address which will spend the funds.
     * @param _value The _amount of tokens to be spent.
     */
    function approve(address _spender, uint256 _value) public returns (bool) {
        _allowances[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    /**
     * @dev Increase the _amount of tokens that an owner has allowed to a _spender.
     * This method should be used instead of approve() to avoid the double approval vulnerability
     * described above.
     * @param _spender The address which will spend the funds.
     * @param _addedValue The _amount of tokens to increase the allowance by.
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
     * @dev Decrease the _amount of tokens that an owner has allowed to a _spender.
     * @param _spender The address which will spend the funds.
     * @param _subtractedValue The _amount of tokens to decrease the allowance by.
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
     * @notice Mints new tokens, increasing totalSupply.
     */
    function mint(address _account, uint256 _amount) external onlyVault {
        return _mint(_account, _amount);
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
    function _mint(address _account, uint256 _amount) internal {
        require(_account != address(0), "Mint to the zero address");

        _totalSupply = _totalSupply.add(_amount);

        uint256 creditAmount = _amount.mulTruncate(creditsPerToken);
        _creditBalances[_account] = _creditBalances[_account].add(creditAmount);
        totalCredits = totalCredits.add(creditAmount);

        emit Transfer(address(0), _account, _amount);
    }

    /**
     * @notice Burns tokens, decreasing totalSupply.
     */
    function burn(address account, uint256 amount) external onlyVault {
        return _burn(account, amount);
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
    function _burn(address _account, uint256 _amount) internal {
        require(_account != address(0), "Burn from the zero address");

        _totalSupply = _totalSupply.sub(_amount);

        uint256 creditAmount = _amount.mulTruncate(_creditsPerToken(_account));
        _creditBalances[_account] = _creditBalances[_account].sub(
            creditAmount,
            "Burn exceeds balance"
        );
        totalCredits = totalCredits.sub(creditAmount);

        emit Transfer(_account, address(0), _amount);
    }

    /**
     * @notice Get the credits per token for an account. Returns a fixed amount
     * if the account is non rebasing.
     */
    function _creditsPerToken(address _account)
        internal
        view
        returns (uint256)
    {
        if (nonRebasingCreditsPerToken[_account] != 0) {
            return nonRebasingCreditsPerToken[_account];
        } else {
            return creditsPerToken;
        }
    }

    /**
     * @notice Is an accounts balance non rebasing, i.e. does not alter with rebases
     */
    function _isNonRebasingAddress(address _account)
        internal
        view
        returns (bool)
    {
        return Address.isContract(_account) && !rebaseOptInList[_account];
    }

    /**
     * @notice Add a contract address to the non rebasing exception list. I.e. the
     * address's balance will be part of rebases so the account will be exposed
     * to upside and downside.
     */
    function rebaseOptIn() public {
        require(Address.isContract(msg.sender), "Address is not a contract");
        require(!rebaseOptInList[msg.sender], "Account has already opted in");
        rebaseOptInList[msg.sender] = true;
        nonRebasingCredits -= _creditBalances[msg.sender];
        nonRebasingSupply -= balanceOf(msg.sender);
        // Convert balance into the same amount at the current exchange rate
        _creditBalances[msg.sender] = _creditBalances[msg.sender]
            .mulTruncate(nonRebasingCreditsPerToken[msg.sender])
            .divPrecisely(creditsPerToken);
        delete nonRebasingCreditsPerToken[msg.sender];
    }

    /**
     * @notice Remove a contract address to the non rebasing exception list.
     */
    function rebaseOptOut() public {
        require(Address.isContract(msg.sender), "Address is not a contract");
        require(rebaseOptInList[msg.sender], "Account has not opted in");
        nonRebasingCredits += _creditBalances[msg.sender];
        nonRebasingSupply += balanceOf(msg.sender);
        nonRebasingCreditsPerToken[msg.sender] = creditsPerToken;
        delete rebaseOptInList[msg.sender];
    }

    /**
     * @dev Modify the supply without minting new tokens. This uses a change in
     *      the exchange rate between "credits" and OUSD tokens to change balances.
     * @param _newTotalSupply New total supply of OUSD.
     * @return uint256 representing the new total supply.
     */
    function changeSupply(uint256 _newTotalSupply)
        external
        onlyVault
        returns (uint256)
    {
        require(_totalSupply > 0, "Cannot increase 0 supply");

        if (_totalSupply == _newTotalSupply) {
            emit TotalSupplyUpdated(_totalSupply);
            return _totalSupply;
        }

        _totalSupply = _newTotalSupply;

        if (_totalSupply > MAX_SUPPLY) _totalSupply = MAX_SUPPLY;

        uint256 rebasingCredits = totalCredits.sub(nonRebasingCredits);
        creditsPerToken = rebasingCredits.divPrecisely(
            _totalSupply - nonRebasingSupply
        );

        emit TotalSupplyUpdated(_totalSupply);

        return _totalSupply;
    }
}
