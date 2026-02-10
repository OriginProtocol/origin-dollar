// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Generalized 4626 Strategy
 * @notice Investment strategy for ERC-4626 Tokenized Vaults
 * @dev This strategy should not be used for the Morpho V2 Vaults as those are not
 *      completley ERC-4626 compliant - they don't implement the maxWithdraw() and 
 *      maxRedeem() functions and rather return 0 when any of them is called.
 * @author Origin Protocol Inc
 */
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { IDistributor } from "../interfaces/IMerkl.sol";

contract Generalized4626Strategy is InitializableAbstractStrategy {
    /// @notice The address of the Merkle Distributor contract.
    IDistributor public constant merkleDistributor =
        IDistributor(0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae);

    /// @dev Replaced with an immutable variable
    // slither-disable-next-line constable-states
    address private _deprecate_shareToken;
    /// @dev Replaced with an immutable variable
    // slither-disable-next-line constable-states
    address private _deprecate_assetToken;

    IERC20 public immutable shareToken;
    IERC20 public immutable assetToken;

    // For future use
    uint256[50] private __gap;

    event ClaimedRewards(address indexed token, uint256 amount);

    /**
     * @param _baseConfig Base strategy config with platformAddress (ERC-4626 Vault contract), eg sfrxETH or sDAI,
     * and vaultAddress (OToken Vault contract), eg VaultProxy or OETHVaultProxy
     * @param _assetToken Address of the ERC-4626 asset token. eg frxETH or DAI
     */
    constructor(BaseStrategyConfig memory _baseConfig, address _assetToken)
        InitializableAbstractStrategy(_baseConfig)
    {
        shareToken = IERC20(_baseConfig.platformAddress);
        assetToken = IERC20(_assetToken);
    }

    function initialize() external virtual onlyGovernor initializer {
        address[] memory rewardTokens = new address[](0);
        address[] memory assets = new address[](1);
        address[] memory pTokens = new address[](1);

        assets[0] = address(assetToken);
        pTokens[0] = address(platformAddress);

        InitializableAbstractStrategy._initialize(
            rewardTokens,
            assets,
            pTokens
        );
    }

    /**
     * @dev Deposit assets by converting them to shares
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    /**
     * @dev Deposit assets by converting them to shares
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal virtual {
        require(_amount > 0, "Must deposit something");
        require(_asset == address(assetToken), "Unexpected asset address");

        // slither-disable-next-line unused-return
        IERC4626(platformAddress).deposit(_amount, address(this));
        emit Deposit(_asset, address(shareToken), _amount);
    }

    /**
     * @dev Deposit the entire balance of assetToken to gain shareToken
     */
    function depositAll() external virtual override onlyVault nonReentrant {
        uint256 balance = assetToken.balanceOf(address(this));
        if (balance > 0) {
            _deposit(address(assetToken), balance);
        }
    }

    /**
     * @dev Withdraw asset by burning shares
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external virtual override onlyVault nonReentrant {
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");
        require(_asset == address(assetToken), "Unexpected asset address");

        // slither-disable-next-line unused-return
        IERC4626(platformAddress).withdraw(_amount, _recipient, address(this));
        emit Withdrawal(_asset, address(shareToken), _amount);
    }

    /**
     * @dev Internal method to respond to the addition of new asset / share tokens
     */
    function _abstractSetPToken(address, address) internal virtual override {
        _approveBase();
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll()
        external
        virtual
        override
        onlyVaultOrGovernor
        nonReentrant
    {
        // @dev Don't use for Morpho V2 Vaults as below line will return 0
        uint256 sharesToRedeem = IERC4626(platformAddress).maxRedeem(address(this));

        uint256 assetAmount = 0;
        if (sharesToRedeem > 0) {
            assetAmount = IERC4626(platformAddress).redeem(
                sharesToRedeem,
                vaultAddress,
                address(this)
            );
            emit Withdrawal(
                address(assetToken),
                address(shareToken),
                assetAmount
            );
        }
    }

    /**
     * @notice Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        public
        view
        virtual
        override
        returns (uint256 balance)
    {
        require(_asset == address(assetToken), "Unexpected asset address");
        /* We are intentionally not counting the amount of assetToken parked on the
         * contract toward the checkBalance. The deposit and withdraw functions
         * should not result in assetToken being unused and owned by this strategy
         * contract.
         */
        IERC4626 platform = IERC4626(platformAddress);
        return platform.previewRedeem(platform.balanceOf(address(this)));
    }

    /**
     * @notice Governor approves the ERC-4626 Tokenized Vault to spend the asset.
     */
    function safeApproveAllTokens() external override onlyGovernor {
        _approveBase();
    }

    function _approveBase() internal virtual {
        // Approval the asset to be transferred to the ERC-4626 Tokenized Vault.
        // Used by the ERC-4626 deposit() and mint() functions
        // slither-disable-next-line unused-return
        assetToken.approve(platformAddress, type(uint256).max);
    }

    /**
     * @dev Returns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset)
        public
        view
        virtual
        override
        returns (bool)
    {
        return _asset == address(assetToken);
    }

    /**
     * @notice is not supported for this strategy as the asset and
     * ERC-4626 Tokenized Vault are set at deploy time.
     * @dev If the ERC-4626 Tokenized Vault needed to be changed, a new
     * contract would need to be deployed and the proxy updated.
     */
    function setPTokenAddress(address, address) external override onlyGovernor {
        revert("unsupported function");
    }

    /**
     * @notice is not supported for this strategy as the asset and
     * ERC-4626 Tokenized Vault are set at deploy time.
     * @dev If the ERC-4626 Tokenized Vault needed to be changed, a new
     * contract would need to be deployed and the proxy updated.
     */
    function removePToken(uint256) external override onlyGovernor {
        revert("unsupported function");
    }

    /// @notice Claim tokens from the Merkle Distributor
    /// @param token The address of the token to claim.
    /// @param amount The amount of tokens to claim.
    /// @param proof The Merkle proof to validate the claim.
    function merkleClaim(
        address token,
        uint256 amount,
        bytes32[] calldata proof
    ) external {
        address[] memory users = new address[](1);
        users[0] = address(this);

        address[] memory tokens = new address[](1);
        tokens[0] = token;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        bytes32[][] memory proofs = new bytes32[][](1);
        proofs[0] = proof;

        merkleDistributor.claim(users, tokens, amounts, proofs);

        emit ClaimedRewards(token, amount);
    }
}
