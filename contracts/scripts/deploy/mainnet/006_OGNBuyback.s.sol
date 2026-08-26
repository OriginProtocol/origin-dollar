// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import {FeeSplitter} from "contracts/harvest/FeeSplitter.sol";
import {SetXOGNRewardRateModule} from "contracts/automation/SetXOGNRewardRateModule.sol";

// Interfaces
import {IFeeSplitter} from "contracts/interfaces/IFeeSplitter.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Addresses
import {Mainnet, CrossChain} from "tests/utils/Addresses.sol";

interface IOToken {
    function rebaseState(address account) external view returns (uint8);
    function mint(address account, uint256 amount) external;
}

/// @title 006_OGNBuyback
/// @notice Routes protocol fees through a FeeSplitter and automates the xOGN reward rate.
/// @dev Two problems are being fixed. Protocol fees currently land in a 1-of-3 Safe
///      (0xBB077E71...) which is the `trusteeAddress` on every chain, and the xOGN reward
///      rate is set by hand each week.
///
///      This deploys:
///        - FeeSplitter, the new standing fee recipient. Splits each fee asset between
///          the operations wallet and the OGN CoW harvester (0x637C5093...).
///        - SetXOGNRewardRateModule, a Guardian Safe module letting Talos move the reward
///          rate inside bounds the Safe sets.
///
///      Every tunable comes from scripts/config/ogn-buyback.json so the values are
///      reviewable in one place and shared with the Talos actions.
///
///      NOTE FOR REVIEWERS: this changes staker economics. Today 100% of protocol fees
///      buy OGN for xOGN stakers — the fee Safe has sent tokens to nothing but the CoW
///      settlement contract for at least 90 days. A non-zero `operationsBps` diverts that
///      share away from stakers and lowers the computed reward rate proportionally.
contract $006_OGNBuyback is AbstractDeployScript("006_OGNBuyback") {
    using GovHelper for GovProposal;

    string internal constant CONFIG_PATH = "scripts/config/ogn-buyback.json";

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        string memory config = vm.readFile(CONFIG_PATH);

        // --- FeeSplitter
        //
        // Governable makes the deployer the governor, so everything below is
        // configured in this one transaction before handing over. `optIntoRebase`
        // in particular is cheapest now, while the balance is still zero.
        FeeSplitter feeSplitter = new FeeSplitter();
        _recordDeployment("FeeSplitter", address(feeSplitter), type(FeeSplitter).name);

        feeSplitter.setOperationsBps(uint16(vm.parseJsonUint(config, ".split.operationsBps")));
        feeSplitter.setOperationsWallet(vm.parseJsonAddress(config, ".split.operationsWallet"));
        feeSplitter.setHarvester(Mainnet.OGNCoWHarvester);
        feeSplitter.setOperatorAddr(CrossChain.talosRelayer);

        string[] memory assetNames = vm.parseJsonKeys(config, ".assets");
        for (uint256 i = 0; i < assetNames.length; ++i) {
            string memory base = string.concat(".assets.", assetNames[i]);
            address token = vm.parseJsonAddress(config, string.concat(base, ".address"));

            feeSplitter.addAsset(token, vm.parseJsonUint(config, string.concat(base, ".minDistribute")));

            // OTokens mark contracts non-rebasing on first receipt. Without this the
            // fees waiting here would stop earning yield, which the multisig this
            // replaces does earn.
            if (vm.parseJsonBool(config, string.concat(base, ".rebasing"))) {
                feeSplitter.optIntoRebase(token);
            }
        }

        feeSplitter.setStrategistAddr(CrossChain.multichainStrategist);

        // Two-step handover: the timelock must claim, which is a proposal action.
        feeSplitter.transferGovernance(Mainnet.Timelock);

        // --- SetXOGNRewardRateModule
        //
        // Bounds start zeroed and are set by the Guardian after the module is enabled
        // on the Safe. There is no safe default for them.
        SetXOGNRewardRateModule rateModule = new SetXOGNRewardRateModule(
            CrossChain.multichainStrategist,
            CrossChain.talosRelayer,
            Mainnet.OGNRewardsSource,
            Mainnet.OGN,
            Mainnet.xOGN
        );
        _recordDeployment("SetXOGNRewardRateModule", address(rateModule), type(SetXOGNRewardRateModule).name);
    }

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        address feeSplitter = resolver.resolve("FeeSplitter");

        govProposal.setDescription(
            "Route protocol fees through the FeeSplitter\n\n"
            "Protocol fees (20% of OUSD and OETH yield) are currently minted to a Safe with "
            "three owners and a threshold of one. This proposal makes a FeeSplitter contract "
            "the fee recipient instead, so the routing is fixed in code and no human holds " "protocol fees.\n\n"
            "CHANGE TO STAKER ECONOMICS: today 100% of these fees are spent buying OGN for "
            "xOGN stakers. The FeeSplitter is configured to send 20% to the operations wallet "
            "and 80% to the OGN buyback. This reduces OGN bought for stakers by roughly a "
            "fifth, and lowers the xOGN reward rate proportionally.\n\n"
            "The FeeSplitter's operations wallet, harvester and split percentage are all "
            "governor-only, so any future change to where fees go requires another vote."
        );

        // The deployer called transferGovernance; without this claim the splitter stays
        // under the deployer key.
        govProposal.action(feeSplitter, "claimGovernance()", "");

        govProposal.action(Mainnet.VaultProxy, "setTrusteeAddress(address)", abi.encode(feeSplitter));
        govProposal.action(Mainnet.OETHVaultProxy, "setTrusteeAddress(address)", abi.encode(feeSplitter));
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        string memory config = vm.readFile(CONFIG_PATH);

        address feeSplitterAddr = resolver.resolve("FeeSplitter");
        IFeeSplitter feeSplitter = IFeeSplitter(feeSplitterAddr);

        // --- Governance took effect
        require(IVault(Mainnet.VaultProxy).trusteeAddress() == feeSplitterAddr, "OUSD vault trustee not repointed");
        require(IVault(Mainnet.OETHVaultProxy).trusteeAddress() == feeSplitterAddr, "OETH vault trustee not repointed");
        require(feeSplitter.governor() == Mainnet.Timelock, "Governance not claimed");

        // --- Configuration matches the file that was reviewed
        require(
            feeSplitter.operationsBps() == uint16(vm.parseJsonUint(config, ".split.operationsBps")),
            "operationsBps mismatch"
        );
        require(
            feeSplitter.operationsWallet() == vm.parseJsonAddress(config, ".split.operationsWallet"),
            "operationsWallet mismatch"
        );
        require(feeSplitter.harvester() == Mainnet.OGNCoWHarvester, "harvester mismatch");
        require(feeSplitter.operatorAddr() == CrossChain.talosRelayer, "operator mismatch");
        require(feeSplitter.strategistAddr() == CrossChain.multichainStrategist, "strategist mismatch");

        string[] memory assetNames = vm.parseJsonKeys(config, ".assets");
        require(feeSplitter.getSupportedAssets().length == assetNames.length, "asset count mismatch");

        for (uint256 i = 0; i < assetNames.length; ++i) {
            string memory base = string.concat(".assets.", assetNames[i]);
            address token = vm.parseJsonAddress(config, string.concat(base, ".address"));

            require(feeSplitter.isSupported(token), "asset not supported");
            require(
                feeSplitter.minDistribute(token) == vm.parseJsonUint(config, string.concat(base, ".minDistribute")),
                "minDistribute mismatch"
            );

            // 2 == RebaseOptions.StdRebasing. Fees must keep earning while parked.
            if (vm.parseJsonBool(config, string.concat(base, ".rebasing"))) {
                require(IOToken(token).rebaseState(feeSplitterAddr) == 2, "FeeSplitter not opted into rebasing");
            }
        }

        // --- The module is deployed and wired, but deliberately unbounded until the
        //     Guardian calls setBounds(). Assert that rather than assume it.
        address rateModule = resolver.resolve("SetXOGNRewardRateModule");
        require(
            ISetXOGNRewardRateModuleView(rateModule).rewardsSource() == Mainnet.OGNRewardsSource,
            "module rewardsSource mismatch"
        );
        require(ISetXOGNRewardRateModuleView(rateModule).minRunway() == 0, "bounds already set");

        _forkVerifyDistribution(feeSplitter);
    }

    /// @dev End-to-end: mint fees the way a rebase does, then distribute and check the split.
    function _forkVerifyDistribution(IFeeSplitter feeSplitter) internal {
        address ops = feeSplitter.operationsWallet();
        uint256 amount = 1000e18;

        // Mint exactly the way VaultCore._rebase does when it takes the fee, so this
        // exercises the real path rather than a poked balance.
        vm.prank(Mainnet.VaultProxy);
        IOToken(Mainnet.OUSDProxy).mint(address(feeSplitter), amount);

        uint256 opsBefore = IERC20(Mainnet.OUSDProxy).balanceOf(ops);
        uint256 harvesterBefore = IERC20(Mainnet.OUSDProxy).balanceOf(Mainnet.OGNCoWHarvester);

        vm.prank(CrossChain.talosRelayer);
        feeSplitter.distribute();

        uint256 opsDelta = IERC20(Mainnet.OUSDProxy).balanceOf(ops) - opsBefore;
        uint256 harvesterDelta = IERC20(Mainnet.OUSDProxy).balanceOf(Mainnet.OGNCoWHarvester) - harvesterBefore;

        uint256 expectedOps = (amount * feeSplitter.operationsBps()) / 1e4;
        // Rebasing balances can round by a wei on transfer, so allow 1 wei either way
        // rather than asserting exact equality.
        require(_within(opsDelta, expectedOps, 1), "ops share wrong");
        require(_within(harvesterDelta, amount - expectedOps, 1), "buyback share wrong");
    }

    function _within(uint256 a, uint256 b, uint256 tolerance) internal pure returns (bool) {
        return a > b ? a - b <= tolerance : b - a <= tolerance;
    }
}

interface ISetXOGNRewardRateModuleView {
    function rewardsSource() external view returns (address);
    function minRunway() external view returns (uint256);
}
