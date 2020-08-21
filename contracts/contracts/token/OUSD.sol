pragma solidity 0.5.17;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import {
    Initializable
} from "@openzeppelin/upgrades/contracts/Initializable.sol";

import { IVault } from "../interfaces/IVault.sol";
import { InitializableToken } from "../utils/InitializableToken.sol";
import "../utils/StableMath.sol";

contract OUSD is Initializable, InitializableToken {
    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    event ExchangeRateUpdated(uint256 totalSupply);

    uint256 private constant UINT_MAX_VALUE = ~uint256(0);
    uint256 private constant MAX_SUPPLY = ~uint128(0); // (2^128) - 1

    uint256 private _totalSupply;
    uint256 private totalCredits;
    // Exchange rate between internal credits and OUSD
    uint256 private creditsPerToken;

    mapping(address => uint256) private _creditBalances;

    // Allowances denominated in OUSD
    mapping(address => mapping(address => uint256)) private _allowances;

    address vaultAddress;

    function initialize(
        string calldata _nameArg,
        string calldata _symbolArg,
        address _vaultAddress
    ) external initializer {
        InitializableToken._initialize(_nameArg, _symbolArg);

        _totalSupply = 0;
        totalCredits = 0;
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
        return _creditBalances[_account].divPrecisely(creditsPerToken);
    }

    /**
     * @dev Transfer tokens to a specified address.
     * @param _to the address to transfer to.
     * @param _value the _amount to be transferred.
     * @return true on success, false otherwise.
     */
    function transfer(address _to, uint256 _value) public returns (bool) {
        uint256 creditValue = _value.mulTruncate(creditsPerToken);
        _creditBalances[msg.sender] = _creditBalances[msg.sender].sub(
            creditValue
        );
        _creditBalances[_to] = _creditBalances[_to].add(creditValue);
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

        uint256 creditValue = _value.mulTruncate(creditsPerToken);
        _creditBalances[_from] = _creditBalances[_from].sub(creditValue);
        _creditBalances[_to] = _creditBalances[_to].add(creditValue);
        emit Transfer(_from, _to, _value);

        return true;
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
     *
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
    function mint(address _asset, uint256 _amount) public {
        IVault vault = IVault(vaultAddress);

        require(!vault.isDepositPaused(), "Deposits are paused");
        require(vault.isSupportedAsset(_asset), "Asset is not supported");

        // Transfer asset to Vault
        IERC20 asset = IERC20(_asset);
        require(
            asset.allowance(msg.sender, address(this)) >= _amount,
            "Allowance is not sufficient"
        );
        asset.safeTransferFrom(msg.sender, vaultAddress, _amount);

        // Direct Vault to allocate asset to strategy
        vault.allocateAsset(_asset, _amount);

        uint256 priceAdjustedDeposit = vault.priceUSD(_asset, _amount);
        return _mint(msg.sender, priceAdjustedDeposit);
    }

    /**
     * @notice Mint for multiple assets in the same call.
     */
    function mintMultiple(address[] memory _assets, uint256[] memory _amounts)
        public
    {
        for (uint256 i = 0; i < _assets.length; i++) {
            mint(_assets[i], _amounts[i]);
        }
    }

    /**
     * @dev Creates `_amount` tokens and assigns them to the caller, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     */
    function _mint(address _account, uint256 _amount) internal {
        _totalSupply = _totalSupply.add(_amount);

        uint256 creditAmount = _amount.mulTruncate(creditsPerToken);
        _creditBalances[_account] = _creditBalances[_account].add(creditAmount);
        totalCredits = totalCredits.add(creditAmount);

        emit Transfer(address(0), msg.sender, _amount);
    }

    /**
     * @notice Redeem OUSD for an asset. Burns the OUSD and returns the asset
     *         to the caller.
     */
    function redeem(address _asset, uint256 _amount) public {
        _redeem(_asset, _amount);
    }

    /**
     * @notice Redeem OUSD for an asset. Burns the OUSD and returns the asset
     * @param _asset Asset to redeem to
     * @param _amount Amount of OUSD to redeem
     */
    function _redeem(address _asset, uint256 _amount) internal {
        IVault vault = IVault(vaultAddress);

        require(vault.isSupportedAsset(_asset), "Asset is not supported");
        require(
            allowance(msg.sender, address(this)) >= _amount,
            "Allowance is not sufficient"
        );

        // Must be non-reentrant
        vault.withdrawAsset(msg.sender, _asset, _amount);

        _burn(msg.sender, _amount);
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

        uint256 creditAmount = _amount.mulTruncate(creditsPerToken);
        _creditBalances[_account] = _creditBalances[_account].sub(
            creditAmount,
            "Burn _amount exceeds balance"
        );
        totalCredits = totalCredits.sub(creditAmount);

        emit Transfer(_account, address(0), _amount);
    }

    /**
     * @dev Modify the supply without minting new tokens. This uses a change in
     *      the exchange rate between "credits" and OUSD tokens to change balances.
     * @param _supplyDelta Change in the total supply.
     * @return uint256 representing the new total supply.
     */
    function changeSupply(int256 _supplyDelta)
        external
        onlyVault
        returns (uint256)
    {
        require(_totalSupply > 0, "Cannot increase 0 supply");

        if (_supplyDelta == 0) {
            emit ExchangeRateUpdated(_totalSupply);
            return _totalSupply;
        }

        if (_supplyDelta < 0) {
            _totalSupply = _totalSupply.sub(uint256(-_supplyDelta));
        } else {
            _totalSupply = _totalSupply.add(uint256(_supplyDelta));
        }

        if (_totalSupply > MAX_SUPPLY) {
            _totalSupply = MAX_SUPPLY;
        }

        // Applied _supplyDelta can differ from specified _supplyDelta by < 1
        creditsPerToken = totalCredits.divPrecisely(_totalSupply);

        emit ExchangeRateUpdated(_totalSupply);

        return _totalSupply;
    }
}
