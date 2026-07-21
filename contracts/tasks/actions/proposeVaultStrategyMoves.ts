/// <reference types="hardhat/types/runtime" />

import { Contract } from "ethers";
import { formatUnits, getAddress } from "ethers/lib/utils";
import { types } from "hardhat/config";

import addresses from "../../utils/addresses";
import { action } from "../lib/action";
import {
  assertNonceStillAvailable,
  assertRegisteredDelegate,
  createSafeClients,
  createSafeTransaction,
  estimateSafeTransaction,
  findIdenticalProposal,
  proposeSafeTransaction,
  resolveNonce,
  safeTransactionUrl,
  toMetaTransactions,
} from "../lib/safeProposal";
import {
  TOKEN_ABI,
  VAULT_ABI,
  buildBatchCalls,
  getVaultConfig,
  parseMoves,
  resolveCheckerValues,
  resolveMoves,
  runLocalForkSimulation,
} from "../lib/vaultStrategyMoves";

action({
  name: "proposeVaultStrategyMoves",
  description:
    "Simulate and propose Strategist Safe deposits, withdrawals, and rebalances wrapped by the Vault Value Checker",
  chains: [1, 8453],
  params: (t) => {
    t.addParam("vault", "OUSD, OETH, or SuperOETH", undefined, types.string);
    t.addParam(
      "moves",
      "Semicolon-separated deposit, withdraw, and withdrawAll operations",
      undefined,
      types.string
    );
    t.addOptionalParam(
      "nonce",
      "Exact Safe nonce to use instead of the next available nonce",
      undefined,
      types.int
    );
    t.addOptionalParam(
      "expectedProfit",
      "Signed 18-decimal Value Checker expected profit override",
      undefined,
      types.string
    );
    t.addOptionalParam(
      "profitVariance",
      "Unsigned 18-decimal Value Checker profit variance override",
      undefined,
      types.string
    );
    t.addOptionalParam(
      "expectedVaultChange",
      "Signed 18-decimal Value Checker expected vault change override",
      undefined,
      types.string
    );
    t.addOptionalParam(
      "vaultChangeVariance",
      "Unsigned 18-decimal Value Checker vault change variance override",
      undefined,
      types.string
    );
    t.addFlag(
      "skipFork",
      "Skip the local fork; expectedProfit and expectedVaultChange become required"
    );
    t.addFlag("skipEstimation", "Skip final Safe transaction estimation");
    t.addFlag("dryrun", "Validate and simulate without proposing");
  },
  run: async ({ signer, chainId, log, args }) => {
    const provider = signer.provider!;
    const config = getVaultConfig(args.vault, chainId);
    const safeAddress = getAddress(addresses.multichainStrategist);
    const apiKey = process.env.SAFE_API_KEY;
    if (!apiKey) throw new Error("SAFE_API_KEY is required");

    const deploymentRegistry = (hre as any).deployments;
    const [vaultDeployment, checkerDeployment] = await Promise.all([
      deploymentRegistry.getOrNull(config.vaultDeployment),
      deploymentRegistry.getOrNull(config.checkerDeployment),
    ]);
    if (!vaultDeployment) {
      throw new Error(
        `Missing ${config.vaultDeployment} deployment on the selected network`
      );
    }
    if (!checkerDeployment) {
      throw new Error(
        `Missing ${config.checkerDeployment} deployment on the selected network`
      );
    }
    const vaultAddress = getAddress(vaultDeployment.address);
    const checkerAddress = getAddress(checkerDeployment.address);
    const vault = new Contract(vaultAddress, VAULT_ABI, provider);
    const [assetRaw, oTokenRaw, strategistRaw, activeStrategies] =
      await Promise.all([
        vault.asset(),
        vault.oToken(),
        vault.strategistAddr(),
        vault.getAllStrategies(),
      ]);
    const asset = getAddress(assetRaw);
    const oToken = getAddress(oTokenRaw);
    const vaultStrategist = getAddress(strategistRaw);
    if (vaultStrategist !== safeAddress) {
      throw new Error(
        `${config.name} vault strategist is ${vaultStrategist}, not configured Safe ${safeAddress}`
      );
    }
    const assetToken = new Contract(asset, TOKEN_ABI, provider);
    const assetDecimals = Number(await assetToken.decimals());

    const parsedMoves = parseMoves(args.moves);
    const moves = await resolveMoves({
      moves: parsedMoves,
      asset,
      assetDecimals,
      activeStrategies,
      provider,
      resolveDeployment: async (name) =>
        (
          await deploymentRegistry.getOrNull(name)
        )?.address,
      log,
    });

    log.info(
      `${config.name}: vault ${vaultAddress}, checker ${checkerAddress}, asset ${asset} (${assetDecimals} decimals)`
    );
    moves.forEach((move, index) =>
      log.info(
        `Move ${index + 1}: ${move.kind} ${move.strategyIdentifier} (${
          move.strategy
        })${
          move.amountUnits
            ? ` ${formatUnits(move.amountUnits, assetDecimals)}`
            : ""
        }`
      )
    );

    const { apiKit, protocolKit } = await createSafeClients({
      provider,
      safeAddress,
      chainId,
      apiKey,
    });
    const signerAddress = getAddress(await signer.getAddress());
    await assertRegisteredDelegate({ apiKit, safeAddress, signerAddress });
    const nonceState = await resolveNonce({
      apiKit,
      provider,
      safeAddress,
      requestedNonce: args.nonce,
      log,
    });
    log.info(
      `Safe nonce ${nonceState.nonce} (onchain ${nonceState.onchainNonce}, next available ${nonceState.nextAvailableNonce})`
    );

    let checkerValues;
    if (args.skipFork) {
      checkerValues = resolveCheckerValues({
        config,
        expectedProfit: args.expectedProfit,
        profitVariance: args.profitVariance,
        expectedVaultChange: args.expectedVaultChange,
        vaultChangeVariance: args.vaultChangeVariance,
        skipFork: true,
      });
      log.warn("Skipping local fork simulation");
    } else {
      const blockNumber = await provider.getBlockNumber();
      ({ checkerValues } = await runLocalForkSimulation({
        config,
        blockNumber,
        safeAddress,
        vaultAddress,
        checkerAddress,
        asset,
        oToken,
        moves,
        expectedProfit: args.expectedProfit,
        profitVariance: args.profitVariance,
        expectedVaultChange: args.expectedVaultChange,
        vaultChangeVariance: args.vaultChangeVariance,
        log,
      }));
    }

    log.info(
      `Value Checker: expectedProfit=${formatUnits(
        checkerValues.expectedProfit,
        18
      )}, profitVariance=${formatUnits(
        checkerValues.profitVariance,
        18
      )}, expectedVaultChange=${formatUnits(
        checkerValues.expectedVaultChange,
        18
      )}, vaultChangeVariance=${formatUnits(
        checkerValues.vaultChangeVariance,
        18
      )}`
    );
    if (args.expectedProfit !== undefined) {
      log.info(`Explicit expectedProfit override: ${args.expectedProfit}`);
    }
    if (args.expectedVaultChange !== undefined) {
      log.info(
        `Explicit expectedVaultChange override: ${args.expectedVaultChange}`
      );
    }

    const calls = buildBatchCalls({
      vaultAddress,
      checkerAddress,
      asset,
      moves,
      checkerValues,
    });
    calls.forEach((call, index) =>
      log.info(`Batch call ${index + 1}: ${call.description}`)
    );
    const safeTransaction = await createSafeTransaction({
      protocolKit,
      calls: toMetaTransactions(calls),
      nonce: nonceState.nonce,
    });
    const identical = findIdenticalProposal(
      nonceState.existing,
      safeTransaction
    );
    if (identical) {
      log.warn(
        `Identical proposal already exists: ${safeTransactionUrl(
          chainId,
          safeAddress,
          identical.safeTxHash
        )}`
      );
      return;
    }

    if (args.skipEstimation) {
      log.warn("Skipping final Safe estimation");
    } else {
      const estimate = await estimateSafeTransaction({
        apiKit,
        safeAddress,
        transaction: safeTransaction,
      });
      log.info(`Safe estimation succeeded: safeTxGas=${estimate.safeTxGas}`);
    }

    if (args.dryrun) {
      log.info(
        "[DRY RUN] Delegate is registered; skipping signature and proposal"
      );
      return;
    }
    await assertNonceStillAvailable({
      provider,
      safeAddress,
      nonce: nonceState.nonce,
    });
    const safeTxHash = await proposeSafeTransaction({
      apiKit,
      protocolKit,
      safeAddress,
      signer,
      transaction: safeTransaction,
    });
    log.info(
      `Proposed Safe transaction ${safeTxHash}: ${safeTransactionUrl(
        chainId,
        safeAddress,
        safeTxHash
      )}`
    );
  },
});
