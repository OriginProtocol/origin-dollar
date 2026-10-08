// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IComposableCoW {
    function domainSeparator() external view returns (bytes32);
}

/// @notice EIP-1271 validator for CoW Protocol orders used in token harvesting flows.
/// @dev Signature payload is expected to be abi.encode(Order, r, s, v).
contract HarvestingEIP1271 is IERC1271, Ownable {
    using SafeERC20 for IERC20;
    bytes4 public constant MAGICVALUE = 0x1626ba7e;
    bytes4 public constant INVALID_SIGNATURE = 0xffffffff;
    /// @dev Matches GPv2Order.TYPE_HASH (kind/balance are string types per EIP-712).
    bytes32 private constant ORDER_TYPEHASH = 0xd5a25ba2e97094ad7d83dc28a6572da797d6b3e7fc6663bd93efb789fc17e489;
    mapping(address => bool) public allowedBuyToken;
    mapping(address => bool) public allowedReceiver;

    struct TokenConfig {
        bool enabled;
        uint256 minSellAmount;
    }

    struct Order {
        address sellToken;
        address buyToken;
        address receiver;
        uint256 sellAmount;
        uint256 buyAmount;
        uint32 validTo;
        bytes32 appData;
        uint256 feeAmount;
        bytes32 kind;
        bool partiallyFillable;
        bytes32 sellTokenBalance;
        bytes32 buyTokenBalance;
    }

    event Initialized(address owner, address bot, address composableCoW, bytes32 cowDomainSeparator);
    event BotUpdated(address indexed bot);
    event AllowedBuyTokenSet(address indexed buyToken, bool allowed);
    event AllowedReceiverSet(address indexed receiver, bool allowed);
    event TokenConfigSet(address indexed sellToken, TokenConfig config);
    event TokenConfigDisabled(address indexed sellToken);

    error ZeroAddress();
    error ConfigDisabled();
    error NotAllowed();
    error FailedCall();
    error UnsupportedOperation();

    address public bot;
    address public immutable composableCoW;
    bytes32 public immutable COW_DOMAIN_SEPARATOR;
    address public immutable VAULT_RELAYER;
    mapping(address => TokenConfig) public tokenConfigs;

    constructor(address initialOwner, address initialBot, address composableCoW_, address vaultRelayer) Ownable() {
        if (initialBot == address(0) || composableCoW_ == address(0) || vaultRelayer == address(0)) {
            revert ZeroAddress();
        }
        composableCoW = composableCoW_;
        COW_DOMAIN_SEPARATOR = IComposableCoW(composableCoW_).domainSeparator();
        VAULT_RELAYER = vaultRelayer;

        bot = initialBot;
        _transferOwnership(initialOwner);
        emit Initialized(initialOwner, initialBot, composableCoW, COW_DOMAIN_SEPARATOR);
    }

    /// @notice EIP-1271 signature check used by CoW Protocol's settlement.
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        (Order memory order, bytes32 r, bytes32 s, uint8 v) = abi.decode(signature, (Order, bytes32, bytes32, uint8));

        if (_hashOrder(order, COW_DOMAIN_SEPARATOR) != hash) {
            return INVALID_SIGNATURE;
        }
        if (getMessageSigner(hash, r, s, v) != bot) {
            return INVALID_SIGNATURE;
        }
        if (!_isOrderValid(order)) {
            return INVALID_SIGNATURE;
        }

        return MAGICVALUE;
    }

    /// @notice Public helper for computing CoW order hashes.
    function hashOrder(Order memory order) external view returns (bytes32) {
        return _hashOrder(order, COW_DOMAIN_SEPARATOR);
    }

    function _hashOrder(Order memory order, bytes32 domainSeparator) internal pure returns (bytes32) {
        bytes32 orderHash = keccak256(abi.encode(ORDER_TYPEHASH, order));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, orderHash));
    }

    /// @notice returns 0x0 address if the signature is invalid.
    function getMessageSigner(bytes32 orderDigest, bytes32 r, bytes32 s, uint8 v) public pure returns (address) {
        bytes memory prefix = "\x19COWSWAP order digest:\n32";
        bytes32 messageHash = keccak256(abi.encodePacked(prefix, orderDigest));
        return ecrecover(messageHash, v, r, s);
    }

    function _isOrderValid(Order memory order) internal view returns (bool) {
        TokenConfig memory config = tokenConfigs[order.sellToken];
        if (!config.enabled) return false;
        if (!allowedBuyToken[order.buyToken]) return false;
        if (!allowedReceiver[order.receiver]) return false;
        if (order.partiallyFillable) return false;
        if (order.sellAmount == 0 || order.buyAmount == 0) return false;
        if (order.validTo < block.timestamp) return false;
        if (order.sellAmount < config.minSellAmount) return false;
        if (order.feeAmount != 0) return false;

        return true;
    }

    // Setters
    function setBot(address newBot) external onlyOwner {
        if (newBot == address(0)) revert ZeroAddress();
        bot = newBot;
        emit BotUpdated(newBot);
    }

    function setAllowedBuyToken(address buyToken, bool allowed) external onlyOwner {
        if (buyToken == address(0)) revert ZeroAddress();
        allowedBuyToken[buyToken] = allowed;
        emit AllowedBuyTokenSet(buyToken, allowed);
    }

    function setAllowedReceiver(address receiver, bool allowed) external onlyOwner {
        if (receiver == address(0)) revert ZeroAddress();
        allowedReceiver[receiver] = allowed;
        emit AllowedReceiverSet(receiver, allowed);
    }

    function setTokenConfig(address sellToken, TokenConfig calldata config) external onlyOwner {
        if (sellToken == address(0)) revert ZeroAddress();
        if (!config.enabled) revert ConfigDisabled();
        IERC20(sellToken).safeApprove(VAULT_RELAYER, type(uint256).max);
        tokenConfigs[sellToken] = config;
        emit TokenConfigSet(sellToken, config);
    }

    function disableToken(address sellToken) external onlyOwner {
        tokenConfigs[sellToken].enabled = false;
        IERC20(sellToken).safeApprove(VAULT_RELAYER, 0);
        emit TokenConfigDisabled(sellToken);
    }

    // Function to rescue non configured ERC20 tokens to the owner
    function transferTokens(address token, uint256 amount) external onlyOwner {
        TokenConfig memory config = tokenConfigs[token];
        if (config.enabled) {
            revert NotAllowed();
        }

        IERC20(token).safeTransfer(owner(), amount);
    }

    function renounceOwnership() public override onlyOwner {
        revert UnsupportedOperation();
    }
}
