// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
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

    /**
     * @notice deposit() function not used for this strategy. Use depositAll() instead.
     */
    function deposit(address, uint256) public override onlyVault nonReentrant {
        // This method no longer used by the VaultAdmin, and we don't want it
        // to be used by VaultCore.
        require(false, "use depositAll() instead");
    }

    /**
     * @notice Takes all given frxETH and creates new redeem tickets
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
            // slither-disable-next-line unchecked-transfer
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
        uint256 startingBalance = payable(address(this)).balance;
        for (uint256 i = 0; i < _nftIds.length; i++) {
            uint256 nftId = _nftIds[i];
            redemptionQueue.burnRedemptionTicketNft(
                nftId,
                payable(address(this))
            );
            emit RedeemNFTBurned(nftId);
        }

        uint256 currentBalance = payable(address(this)).balance;
        uint256 redeemedAmount = currentBalance - startingBalance;
        require(
            expectedAmount == redeemedAmount,
            "Redeemed amount does not match expected amount"
        );
        outstandingRedeems -= redeemedAmount;
        weth.deposit{ value: currentBalance }();
        // slither-disable-next-line unchecked-transfer
        weth.transfer(vaultAddress, currentBalance);
        emit Withdrawal(
            address(weth),
            address(redemptionQueue),
            currentBalance
        );
    }

    function _abstractSetPToken(address, address) internal override {
        revert("No pTokens are used");
    }

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
            // slither-disable-next-line unchecked-transfer
            weth.transfer(vaultAddress, wethBalance);
            emit Withdrawal(address(weth), address(0), wethBalance);
        }
        uint256 fraxEthBalance = frxETH.balanceOf(address(this));
        if (fraxEthBalance > 0) {
            // slither-disable-next-line unchecked-transfer
            frxETH.transfer(vaultAddress, fraxEthBalance);
            emit Withdrawal(address(frxETH), address(0), fraxEthBalance);
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
        } else if (_asset == address(frxETH)) {
            return 0;
        } else {
            revert("Unexpected asset address");
        }
    }

    /**
     * @notice Approve the spending of all assets by their corresponding cToken,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() public override {
        // slither-disable-next-line unused-return
        frxETH.approve(address(redemptionQueue), type(uint256).max);
    }

    /**
     * @notice Check if an asset is supported.
     * @param _asset    Address of the asset
     * @return bool     Whether asset is supported
     */
    function supportsAsset(address _asset) public pure override returns (bool) {
        // frxETH can be deposited by the vault and balances are reported in weth
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
