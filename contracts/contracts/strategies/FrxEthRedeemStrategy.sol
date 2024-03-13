// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import { BaseCompoundStrategy, InitializableAbstractStrategy } from "./BaseCompoundStrategy.sol";
import { IComptroller } from "../interfaces/IComptroller.sol";
import { IERC20 } from "../utils/InitializableAbstractStrategy.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { IVault } from "../interfaces/IVault.sol";

interface IFraxEtherRedemptionQueue {
    function burnRedemptionTicketNft(uint256 _nftId, address payable _recipient)
        external;

    function enterRedemptionQueue(address _recipient, uint120 _amountToRedeem)
        external
        returns (uint256 _nftId);
}

/**
 * @title Frax ETH Redeem Strategy
 * @notice This strategy redeems Frax ETH for ETH via the Frax Eth Redemption Queue contract
 * @author Origin Protocol Inc
 */
contract FrxEthRedeemStrategy is InitializableAbstractStrategy {
    IWETH9 private constant weth =
        IWETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 private constant frxETH =
        IERC20(0x5E8422345238F34275888049021821E8E08CAa1f);
    IFraxEtherRedemptionQueue private constant redemptionQueue =
        IFraxEtherRedemptionQueue(0x82bA8da44Cd5261762e629dd5c605b17715727bd);
    uint256 public constant maxRedeemTicket = 250e18;
    uint256 public outstandingRedeems;

    event RedeemNFTMinted(uint256 _nftId, uint256 _amount);
    event RedeemNFTBurned(uint256 _nftId);

    constructor(BaseStrategyConfig memory _stratConfig)
        InitializableAbstractStrategy(_stratConfig)
    {
        require(maxRedeemTicket < type(uint120).max);
    }

    /**
     * @notice initialize function, to set up initial internal state
     * @param _rewardTokenAddresses Address of reward token for platform
     * @param _assets Addresses of initial supported assets
     * @param _pTokens Platform Token corresponding addresses
     */
    function initialize(
        address[] memory _rewardTokenAddresses,
        address[] memory _assets,
        address[] memory _pTokens
    ) external onlyGovernor initializer {
        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
        safeApproveAllTokens();
    }

    function deposit(address, uint256) public override onlyVault nonReentrant {
        // This method no longer used by the VaultAdmin, and we don't want it
        // to be used by VaultCore.
        require(false, "use depositAll() instead");
    }

    /**
     * @notice Takes all frxETH and creates new redeem tickets
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 frxETHStart = frxETH.balanceOf(address(this));
        require(frxETHStart > 0, "No frxETH to redeem");
        uint256 frxETHRemaining = frxETHStart;

        while (frxETHRemaining > 0) {
            uint256 amount = frxETHRemaining > maxRedeemTicket
                ? maxRedeemTicket
                : frxETHRemaining;
            uint256 nftId = redemptionQueue.enterRedemptionQueue(
                address(this),
                uint120(amount)
            );
            frxETHRemaining -= amount;
            emit RedeemNFTMinted(nftId, amount);
        }

        require(
            frxETH.balanceOf(address(this)) == 0,
            "Not all FraxEth sent to redemption queue"
        );
        outstandingRedeems += frxETHStart; // Single set for gas reasons

        // This strategy claims to support WETH, so it is posible for
        // the vault to transfer WETH to it. This returns any deposited WETH
        // to the vault so that it is not lost for balance tracking purposes.
        uint256 wethBalance = weth.balanceOf(address(this));
        if (wethBalance > 0) {
            weth.transfer(vaultAddress, wethBalance);
        }

        emit Deposit(address(frxETH), address(redemptionQueue), frxETHStart);
    }

    /**
     * @notice Withdraw an asset from the underlying platform
     * @param _recipient Address to receive withdrawn assets
     * @param _asset Address of the asset to withdraw
     * @param _amount Amount of assets to withdraw
     */
    function withdraw(
        // solhint-disable-next-line no-unused-vars
        address _recipient,
        // solhint-disable-next-line no-unused-vars
        address _asset,
        // solhint-disable-next-line no-unused-vars
        uint256 _amount
    ) external override onlyVault nonReentrant {
        // Does nothing - all redeems need to be called manually by the
        // strategist via redeemTickets
        require(false, "use redeemTickets() instead");
    }

    /**
     * @notice Redeem specific tickets from the Queue.
     * Called by the strategist.
     * @param _nftIds Array of NFT IDs to redeem
     */
    function redeemTickets(uint256[] memory _nftIds, uint256 expectedAmount)
        external
        nonReentrant
    {
        require(
            msg.sender == IVault(vaultAddress).strategistAddr(),
            "Caller is not the Strategist"
        );
        for (uint256 i = 0; i < _nftIds.length; i++) {
            uint256 nftId = _nftIds[i];
            redemptionQueue.burnRedemptionTicketNft(
                nftId,
                payable(address(this))
            );
            emit RedeemNFTBurned(nftId);
        }

        uint256 redeemedAmount = payable(address(this)).balance;
        require(
            expectedAmount == redeemedAmount,
            "Redeemed amount does not match expected amount"
        );
        outstandingRedeems -= redeemedAmount;
        weth.deposit{ value: redeemedAmount }();
        weth.transfer(vaultAddress, redeemedAmount);
    }

    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {}

    /**
     * @notice Withdraw all assets from this strategy, and transfer to the Vault.
     * In correct operation, this strategy should never hold any assets.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        if (payable(address(this)).balance > 0) {
            weth.deposit{ value: payable(address(this)).balance }();
        }
        uint256 wethBalance = weth.balanceOf(address(this));
        if (wethBalance > 0) {
            weth.transfer(vaultAddress, wethBalance);
        }
        uint256 fraxEthBalance = frxETH.balanceOf(address(this));
        if (fraxEthBalance > 0) {
            frxETH.transfer(vaultAddress, fraxEthBalance);
        }
    }

    /**
     * @notice Returns the amount of queued FraxEth that will be returned as WETH.
     * We return this as a WETH asset, since that is what it will eventually be returned as.
     * We only return the outstandingRedeems, because the contract itself should never hold any funds.
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        if (_asset == address(weth)) {
            return outstandingRedeems;
        } else {
            return 0;
        }
    }

    /**
     * @notice Approve the spending of all assets by their corresponding cToken,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() public override {
        frxETH.approve(address(redemptionQueue), type(uint256).max);
    }

    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == address(frxETH) || _asset == address(weth);
    }

    function onERC721Received(
        // solhint-disable-next-line no-unused-vars
        address operator,
        // solhint-disable-next-line no-unused-vars
        address from,
        // solhint-disable-next-line no-unused-vars
        uint256 tokenId,
        // solhint-disable-next-line no-unused-vars
        bytes calldata data
    ) external returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {}
}
