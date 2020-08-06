pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

contract OUSD is ERC20, ERC20Detailed {

    event ExchangeRateUpdated(uint256 totalSupply);

    uint256 public constant UINT_MAX_VALUE = uint256(-1);
    uint256 private constant DECIMALS = 18;
    uint256 private constant MAX_SUPPLY = UINT_MAX_VALUE;

    uint256 private _totalSupply;
    uint256 private _totalCredits;
    uint256 private _creditsPerToken;

    mapping(address => uint256) private _creditBalances;

    // Allowances denominated in OUSD
    mapping (address => mapping (address => uint256)) private _allowances;

    constructor (address vaultAddress) public ERC20Detailed("Origin Dollar", "OUSD", DECIMALS) {
        _totalSupply = 0;
        _totalCredits = 0;
        _creditsPerToken = 1;
    }

    /**
     * @dev Modify the supply without minting new tokens. This uses a change in
            the exchange rate between "credits" and OUSD tokens to change balances.
     * @param supplyDelta Change in the total supply.
     * @return A uint256 representing the new total supply.
     */
    function increaseSupply(int256 supplyDelta) external onlyVault returns (uint256) {
        if (supplyDelta == 0) {
            emit ExchangeRateUpdated(_totalSupply);
            return _totalSupply;
        }

        if (supplyDelta < 0) {
            _totalSupply = _totalSupply.sub(uint256(supplyDelta.abs()));
        } else {
            _totalSupply = _totalSupply.add(uint256(supplyDelta));
        }

        if (_totalSupply > MAX_SUPPLY) {
            _totalSupply = MAX_SUPPLY;
        }

        // Applied supplyDelta can differ from specified supplyDelta by < 1
        _creditsPerToken = _totalCredits.div(_totalSupply);

        emit ExchangeRateUpdated(_totalSupply);

        return _totalSupply;
    }

    /**
     * @dev Gets the balance of the specified address.
     * @param account The address to query the balance of.
     * @return A unit256 representing the amount of base units owned by the
     *         specified address.
     */
    function balanceOf(address account) public view returns (uint256) {
        return _creditBalances[account].div(_creditsPerToken);
    }

    /**
     * @dev Transfer tokens to a specified address.
     * @param to the address to transfer to.
     * @param value the amount to be transferred.
     * @return true on success, false otherwise.
     */
    function transfer(address to, uint256 value) public returns (bool) {
        uint256 creditValue = value.mul(_creditsPerToken);
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
    function transferFrom(address from, address to, uint256 value) public {
        _allowances[from][msg.sender] = _allowances[from][msg.sender].sub(value);

        uint256 creditValue = value.mul(_creditsPerToken);
        _creditBalances[from] = _creditBalances[from].sub(creditValue);
        _creditBalances[to] = _creditBalances[to].add(creditValue);

        emit Transfer(from, to, value);

        return true;
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
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

        uint256 creditAmount = amount.mul(_creditsPerToken);
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

        uint256 creditAmount = amount.mul(_creditsPerToken);
        _creditBalances[account] = _creditBalances[account].sub(creditAmount, "Burn amount exceeds balance");
        _totalCredits = _totalCredits.sub(creditAmount);

        emit Transfer(account, address(0), amount);
    }
}
