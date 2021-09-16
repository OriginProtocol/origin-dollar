// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "./BurnableERC20.sol";
import "./MintableERC20.sol";

/**
 * @title Origin token (OGN).
 *
 * @dev Token that allows minting and burning.
 * @dev Important note:
 * @dev   There is a known race condition in the ERC20 standard on the approve() method.
 * @dev   See details: https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
 * @dev   The Origin token contract implements the increaseApproval() and decreaseApproval() methods.
 * @dev   It is strongly recommended to use those methods rather than approve()
 * @dev   when updating the token allowance.
 */
contract MockOGN is MintableERC20, BurnableERC20 {
    event SetWhitelistExpiration(uint256 expiration);
    event AllowedTransactorAdded(address sender);
    event AllowedTransactorRemoved(address sender);
    event AddCallSpenderWhitelist(address enabler, address spender);
    event RemoveCallSpenderWhitelist(address disabler, address spender);

    mapping(address => bool) public callSpenderWhitelist;
    address public owner = msg.sender;
    // UNIX timestamp (in seconds) after which this whitelist no longer applies
    uint256 public whitelistExpiration;
    // While the whitelist is active, either the sender or recipient must be
    // in allowedTransactors.
    mapping(address => bool) public allowedTransactors;

    // @dev Constructor that gives msg.sender all initial tokens.
    constructor(uint256 _initialSupply) ERC20("OriginToken", "OGN") {
        owner = msg.sender;
        _mint(owner, _initialSupply);
    }

    //
    // approveAndCall methods
    //

    // @dev Add spender to whitelist of spenders for approveAndCall
    // @param _spender Address to add
    function addCallSpenderWhitelist(address _spender) public onlyOwner {
        callSpenderWhitelist[_spender] = true;
        emit AddCallSpenderWhitelist(msg.sender, _spender);
    }

    // @dev Remove spender from whitelist of spenders for approveAndCall
    // @param _spender Address to remove
    function removeCallSpenderWhitelist(address _spender) public onlyOwner {
        delete callSpenderWhitelist[_spender];
        emit RemoveCallSpenderWhitelist(msg.sender, _spender);
    }

    // @dev Approve transfer of tokens and make a contract call in a single
    // @dev transaction. This allows a DApp to avoid requiring two MetaMask
    // @dev approvals for a single logical action, such as creating a listing,
    // @dev which requires the seller to approve a token transfer and the
    // @dev marketplace contract to transfer tokens from the seller.
    //
    // @dev This is based on the ERC827 function approveAndCall and avoids
    // @dev security issues by only working with a whitelisted set of _spender
    // @dev addresses. The other difference is that the combination of this
    // @dev function ensures that the proxied function call receives the
    // @dev msg.sender for this function as its first parameter.
    //
    // @param _spender The address that will spend the funds.
    // @param _value The amount of tokens to be spent.
    // @param _selector Function selector for function to be called.
    // @param _callParams Packed, encoded parameters, omitting the first parameter which is always msg.sender
    function approveAndCallWithSender(
        address _spender,
        uint256 _value,
        bytes4 _selector,
        bytes memory _callParams
    ) public payable returns (bool) {
        require(_spender != address(this), "token contract can't be approved");
        require(callSpenderWhitelist[_spender], "spender not in whitelist");

        require(super.approve(_spender, _value), "approve failed");

        bytes memory callData = abi.encodePacked(
            _selector,
            uint256(uint160(msg.sender)),
            _callParams
        );
        // solium-disable-next-line security/no-call-value
        (bool success, ) = _spender.call{ value: msg.value }(callData);
        require(success, "proxied call failed");
        return true;
    }

    //
    // Functions for maintaining whitelist
    //

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }
    modifier allowedTransfer(address _from, address _to) {
        require(
            // solium-disable-next-line operator-whitespace
            !whitelistActive() ||
                allowedTransactors[_from] ||
                allowedTransactors[_to],
            "neither sender nor recipient are allowed"
        );
        _;
    }

    function whitelistActive() public view returns (bool) {
        return block.timestamp < whitelistExpiration;
    }

    function addAllowedTransactor(address _transactor) public onlyOwner {
        emit AllowedTransactorAdded(_transactor);
        allowedTransactors[_transactor] = true;
    }

    function removeAllowedTransactor(address _transactor) public onlyOwner {
        emit AllowedTransactorRemoved(_transactor);
        delete allowedTransactors[_transactor];
    }

    /**
     * @dev Set the whitelist expiration, after which the whitelist no longer
     * applies.
     */
    function setWhitelistExpiration(uint256 _expiration) public onlyOwner {
        // allow only if whitelist expiration hasn't yet been set, or if the
        // whitelist expiration hasn't passed yet
        require(
            whitelistExpiration == 0 || whitelistActive(),
            "an expired whitelist cannot be extended"
        );
        // prevent possible mistakes in calling this function
        require(
            _expiration >= block.timestamp + 1 days,
            "whitelist expiration not far enough into the future"
        );
        emit SetWhitelistExpiration(_expiration);
        whitelistExpiration = _expiration;
    }

    //
    // ERC20 transfer functions that have been overridden to enforce the
    // whitelist.
    //

    function transfer(address _to, uint256 _value)
        public
        override
        allowedTransfer(msg.sender, _to)
        returns (bool)
    {
        return super.transfer(_to, _value);
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public override allowedTransfer(_from, _to) returns (bool) {
        return super.transferFrom(_from, _to, _value);
    }
}
