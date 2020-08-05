pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

contract OUSD is ERC20, ERC20Detailed {

    uint256 public constant UINT_MAX_VALUE = uint256(-1);
    uint256 private constant DECIMALS = 18;
    uint256 private constant TOTAL_CREDITS = UINT_MAX_VALUE;

    uint256 private _totalSupply;
    uint256 private _creditsPerToken;

    mapping(address => uint256) private _creditBalances;

    // Allowances denominated in OUSD
    mapping (address => mapping (address => uint256)) private _allowances;

    modifier onlyVault {
        require(
            __vault() == msg.sender
            "The caller of this function must be a vault"
        );
        _;
    }

    constructor (address vaultAddress) public ERC20Detailed("Origin Dollar", "OUSD", DECIMALS) {
        _totalSupply = 0;
        _creditBalances[msg.sender] = TOTAL_CREDITS;
        _creditsPerToken = 1;
    }

    /**
     * @dev Increase the supply of OUSD. This will increase the balance for each
            token holder because the exchange rate between credits and tokens
            does not change.
     * @param epoch Epoch to emit with the event.
     * @param supplyDelta Change in the total supply.
     * @return A uint256 representing the new total supply.
     */
    function increaseSupply(uint256 epoch, int256 supplyDelta) external onlyVault returns (uint256) {
        if (supplyDelta == 0) {
            emit ExchangeRateUpdated(epoch, _totalSupply);
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
        _creditsPerToken = TOTAL_CREDITS.div(_totalSupply);
        emit ExchangeRateUpdated(epoch, _totalSupply);
        return _totalSupply;
    }

    /**
     * @dev Gets the balance of the specified address.
     * @param owner The address to query the balance of.
     * @return A unit256 representing the amount of base units owned by the
     *         specified address.
     */
    function balanceOf(address account) public view returns (uint256) {
        return _creditBalances[account].div(_creditsPerToken);
    }

    /**
     * @dev transfer tokens to a specified address.
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

    function transferFrom() {}

    function approve() {}

    function allowance() {}

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
        _creditBalances[account] = _creditBalances[account].add(amount);

        emit Transfer(address(0), account, amount);
    }
}
