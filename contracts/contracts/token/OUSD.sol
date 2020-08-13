pragma solidity 0.5.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../utils/Access.sol";
import "../utils/StableMath.sol";

contract OUSD is ERC20, ERC20Detailed, Access {

    using SafeMath for uint256;
    using StableMath for uint256;

    event ExchangeRateUpdated(uint256 totalSupply);

    uint8 private constant DECIMALS = 18;
    uint256 private constant UINT_MAX_VALUE = ~uint256(0);
    uint256 private constant MAX_SUPPLY = ~uint128(0);  // (2^128) - 1

    uint256 private _totalSupply;
    uint256 private _totalCredits;
    // Exchange rate between internal credits and OUSD
    uint256 private _creditsPerToken;

    mapping(address => uint256) private _creditBalances;

    // Allowances denominated in OUSD
    mapping (address => mapping (address => uint256)) private _allowances;

    constructor (address _kernel)
        public
        Access(_kernel)
        ERC20Detailed("Origin Dollar", "OUSD", DECIMALS
    ) {
        _totalSupply = 0;
        _totalCredits = 0;
        _creditsPerToken = 1e18;
    }

    /**
     * @dev Gets the balance of the specified address.
     * @param account The address to query the balance of.
     * @return A unit256 representing the amount of base units owned by the
     *         specified address.
     */
    function balanceOf(address account) public view returns (uint256) {
        return _creditBalances[account].divPrecisely(_creditsPerToken);
    }

    /**
     * @dev Transfer tokens to a specified address.
     * @param to the address to transfer to.
     * @param value the amount to be transferred.
     * @return true on success, false otherwise.
     */
    function transfer(address to, uint256 value) public returns (bool) {
        uint256 creditValue = value.mulTruncate(_creditsPerToken);
        _creditBalances[msg.sender] = _creditBalances[msg.sender].sub(creditValue);
        _creditBalances[to] = _creditBalances[to].add(creditValue);
        emit Transfer(msg.sender, to, value);

        return true;
    }

    /**
     * @dev Transfer tokens from one address to another.
     * @param from The address you want to send tokens from.
     * @param to The address you want to transfer to.
     * @param value The amount of tokens to be transferred.
     */
    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        _allowances[from][msg.sender] = _allowances[from][msg.sender].sub(value);

        uint256 creditValue = value.mulTruncate(_creditsPerToken);
        _creditBalances[from] = _creditBalances[from].sub(creditValue);
        _creditBalances[to] = _creditBalances[to].add(creditValue);
        emit Transfer(from, to, value);

        return true;
    }

    /**
     * @dev Function to check the amount of tokens that an owner has allowed to a spender.
     * @param owner_ The address which owns the funds.
     * @param spender The address which will spend the funds.
     * @return The number of tokens still available for the spender.
     */
    function allowance(address owner_, address spender)
        public
        view
        returns (uint256)
    {
        return _allowances[owner_][spender];
    }

    /**
     * @dev Approve the passed address to spend the specified amount of tokens on behalf of
     * msg.sender. This method is included for ERC20 compatibility.
     * increaseAllowance and decreaseAllowance should be used instead.
     * Changing an allowance with this method brings the risk that someone may transfer both
     * the old and the new allowance - if they are both greater than zero - if a transfer
     * transaction is mined before the later approve() call is mined.
     *
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     */
    function approve(address spender, uint256 value)
        public
        returns (bool)
    {
        _allowances[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    /**
     * @dev Increase the amount of tokens that an owner has allowed to a spender.
     * This method should be used instead of approve() to avoid the double approval vulnerability
     * described above.
     * @param spender The address which will spend the funds.
     * @param addedValue The amount of tokens to increase the allowance by.
     */
    function increaseAllowance(address spender, uint256 addedValue)
        public
        returns (bool)
    {
        _allowances[msg.sender][spender] =
            _allowances[msg.sender][spender].add(addedValue);
        emit Approval(msg.sender, spender, _allowances[msg.sender][spender]);
        return true;
    }

    /**
     * @dev Decrease the amount of tokens that an owner has allowed to a spender.
     *
     * @param spender The address which will spend the funds.
     * @param subtractedValue The amount of tokens to decrease the allowance by.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue)
        public
        returns (bool)
    {
        uint256 oldValue = _allowances[msg.sender][spender];
        if (subtractedValue >= oldValue) {
            _allowances[msg.sender][spender] = 0;
        } else {
            _allowances[msg.sender][spender] = oldValue.sub(subtractedValue);
        }
        emit Approval(msg.sender, spender, _allowances[msg.sender][spender]);
        return true;
    }

    /**
    * @notice Mints new tokens, increasing totalSupply.
    */
    function mint(address account, uint256 amount) external onlyVault {
        return _mint(account, amount);
    }

    /**
     * @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements
     *
     * - `to` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "Mint to the zero address");

        _totalSupply = _totalSupply.add(amount);

        uint256 creditAmount = amount.mulTruncate(_creditsPerToken);
        _creditBalances[account] = _creditBalances[account].add(creditAmount);
        _totalCredits = _totalCredits.add(creditAmount);

        emit Transfer(address(0), account, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "Burn from the zero address");

        _totalSupply = _totalSupply.sub(amount);

        uint256 creditAmount = amount.mulTruncate(_creditsPerToken);
        _creditBalances[account] = _creditBalances[account].sub(creditAmount, "Burn amount exceeds balance");
        _totalCredits = _totalCredits.sub(creditAmount);

        emit Transfer(account, address(0), amount);
    }

    /**
     * @dev Modify the supply without minting new tokens. This uses a change in
            the exchange rate between "credits" and OUSD tokens to change balances.
     * @param supplyDelta Change in the total supply.
     * @return A uint256 representing the new total supply.
     */
    function increaseSupply(int256 supplyDelta) external onlyVault returns (uint256) {
        require(_totalSupply > 0, "Cannot increase 0 supply");

        if (supplyDelta == 0) {
            emit ExchangeRateUpdated(_totalSupply);
            return _totalSupply;
        }

        if (supplyDelta < 0) {
            _totalSupply = _totalSupply.sub(uint256(-supplyDelta));
        } else {
            _totalSupply = _totalSupply.add(uint256(supplyDelta));
        }

        if (_totalSupply > MAX_SUPPLY) {
            _totalSupply = MAX_SUPPLY;
        }

        // Applied supplyDelta can differ from specified supplyDelta by < 1
        _creditsPerToken = _totalCredits.divPrecisely(_totalSupply);

        emit ExchangeRateUpdated(_totalSupply);

        return _totalSupply;
    }
}
