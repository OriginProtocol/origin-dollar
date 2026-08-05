// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import {ICurvePoolBooster} from "contracts/interfaces/poolBooster/ICurvePoolBooster.sol";
import {ICurvePoolBoosterBribesModule} from "contracts/interfaces/automation/ICurvePoolBoosterBribesModule.sol";

/// @title 004_CurvePoolBoosterRemoteManager
/// @notice Repoints every Curve Pool Booster to Stake DAO's new CampaignRemoteManager.
/// @dev Stake DAO rotated their mainnet CampaignRemoteManager on 2026-07-30
///      (tx 0x3d0262df1cc1aedbc04e68e0bdf6e315877daf6822fe6dcc9b9f97f78983e8dc), de-whitelisting
///      every platform on the old manager and whitelisting them on the new one in the same
///      transaction. Since then `createCampaign()` and `manageCampaign()` on our boosters revert
///      with `PlatformNotWhitelisted()`, which breaks the `manage_curve_pb_mainnet` automation.
///
///      Nothing is deployed here — the fix is a single `setCampaignRemoteManager()` call per
///      booster, which is `onlyGovernor`, so this script only builds a governance proposal.
///      The Votemarket platform address is unchanged and must stay as is.
contract $004_CurvePoolBoosterRemoteManager is AbstractDeployScript("004_CurvePoolBoosterRemoteManager") {
    using GovHelper for GovProposal;

    /// @notice Stake DAO's new mainnet CampaignRemoteManager.
    address internal constant NEW_CAMPAIGN_REMOTE_MANAGER = 0x177198aDb759a9715bC7259BE1b7bE535BeD7542;

    /// @notice Votemarket V2 platform on Arbitrum. Unchanged by the rotation.
    address internal constant VOTEMARKET = 0x8c2c5A295450DDFf4CB360cA73FCCC12243D14D9;

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        address[] memory boosters = _poolBoosters();

        govProposal.setDescription(
            "Repoint Curve Pool Boosters to the new Stake DAO CampaignRemoteManager\n\n"
            "Stake DAO replaced their mainnet CampaignRemoteManager and moved the platform "
            "whitelist over to the new contract. Campaign creation and management from our Curve "
            "Pool Boosters revert until they point at the new manager. This proposal updates the "
            "campaignRemoteManager on all 12 boosters. No other booster configuration changes."
        );

        for (uint256 i = 0; i < boosters.length; i++) {
            govProposal.action(
                boosters[i], "setCampaignRemoteManager(address)", abi.encode(NEW_CAMPAIGN_REMOTE_MANAGER)
            );
        }
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        address[] memory boosters = _poolBoosters();

        // A governance proposal needs a fixed target list, so cross-check it against the live
        // module to catch boosters added or removed between writing and executing the proposal.
        // Resolved rather than read from Mainnet.CurvePoolBoosterBribesModule, which is stale.
        ICurvePoolBoosterBribesModule bribesModule =
            ICurvePoolBoosterBribesModule(payable(resolver.resolve("CURVE_POOL_BOOSTER_BRIBES_MODULE")));
        address[] memory livePoolBoosters = bribesModule.getPoolBoosters();
        require(livePoolBoosters.length == boosters.length, "Pool booster count has changed");
        for (uint256 i = 0; i < boosters.length; i++) {
            require(livePoolBoosters[i] == boosters[i], "Pool booster list has changed");
        }

        for (uint256 i = 0; i < boosters.length; i++) {
            ICurvePoolBooster booster = ICurvePoolBooster(boosters[i]);
            require(booster.campaignRemoteManager() == NEW_CAMPAIGN_REMOTE_MANAGER, "Campaign manager not updated");
            require(booster.votemarket() == VOTEMARKET, "Votemarket has changed");
        }

        // The invariant that broke: manageCampaign() reverts with PlatformNotWhitelisted() unless
        // the platform is whitelisted on the manager the booster calls.
        require(
            ICampaignRemoteManagerWhitelist(NEW_CAMPAIGN_REMOTE_MANAGER).whitelistedPlatforms(VOTEMARKET),
            "Votemarket not whitelisted on the new CampaignRemoteManager"
        );
    }

    // ==================== Internal Helpers ==================== //

    /// @notice The 12 Curve Pool Boosters, in `getPoolBoosters()` order.
    function _poolBoosters() internal pure returns (address[] memory boosters) {
        boosters = new address[](12);
        boosters[0] = 0x2425ff98A23021BF056E96FB690BF49910a8cE49; // OUSD/crvUSD
        boosters[1] = 0x1A43D2F1bb24aC262D1d7ac05D16823E526FcA32; // OETH/ARM-WETH-stETH
        boosters[2] = 0xDafF0D96037B0F7bf72C6e2b3125b5D19273B149; // OUSD/msUSD
        boosters[3] = 0xc835BcA1378acb32C522f3831b8dba161a763FBE; // frxUSD/OUSD
        boosters[4] = 0xd5d46b7e8FF91C3227D2Cf0aAE263f87743e3340; // OGN/OETH
        boosters[5] = 0xE9CA668D5C31Ea5162651667103537bDA5458500; // ynRWAx/OUSD
        boosters[6] = 0x5400a839C198d787c784F370F5a27672285b2133; // OUSD/MUSD
        boosters[7] = 0xAe6058D732f0f3E098A068A338dB07bbD5169d3D; // OUSD/pmUSD
        boosters[8] = 0x5677d1DA3876E86f96F4492bdB8fdbb79C2Bf56c; // OUSD/eUSD
        boosters[9] = 0xFc5fEF2D566f77262CeF4e86749fdF1170b6f63F; // OUSD/USDT
        boosters[10] = 0x077486b01C8670e7F51Dbf7E09Cd648d4a538F87; // OUSD/avUSD
        boosters[11] = 0x634bd2921Fab3413f7db3F03310Fd5F7663badcC; // OUSD/USDe
    }
}

// ==================== External Interface ==================== //

/// @notice Whitelist view on Stake DAO's CampaignRemoteManager, not part of ICampaignRemoteManager.
interface ICampaignRemoteManagerWhitelist {
    function whitelistedPlatforms(address platform) external view returns (bool);
}
