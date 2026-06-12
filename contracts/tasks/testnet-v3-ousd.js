/**
 * Testnet V3 operator tasks for OUSD V3 stack:
 *   Sepolia (Remote / wOUSD) ⇄ Base Sepolia (Master / OUSDb), USDC + CCTP V2.
 *
 * Parallel to testnet-v3.js (which is OETHb + CCIP-BnM). Tasks are namespaced
 * tn:ousd:*. Pass --network sepolia or --network baseSepolia.
 *
 * CCTP delivery is operator-driven: every cross-chain hop requires
 * `tn:ousd:cctp-relay --tx <srcTxHash>` on the destination network after
 * Circle's Iris-sandbox attestation lands (~13-19 min on testnet).
 */
const { task } = require("hardhat/config");
const addresses = require("../utils/addresses");

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];

const IRIS_SANDBOX = "https://iris-api-sandbox.circle.com";

const USDC_DECIMALS = 6;

// --- Helpers ---------------------------------------------------------------

const fmt = (bn) => `${require("ethers").utils.formatUnits(bn, USDC_DECIMALS)}`;
const parseUsdc = (s) => require("ethers").utils.parseUnits(s, USDC_DECIMALS);

const requireNetwork = (hre, expected) => {
  if (hre.network.name !== expected) {
    throw new Error(
      `This task is for --network ${expected} (got ${hre.network.name})`
    );
  }
};

const isBase = (hre) => hre.network.name === "baseSepolia";

const usdcAddr = (hre) =>
  isBase(hre) ? addresses.baseSepolia.USDC : addresses.sepolia.USDC;

const strategyName = (hre) =>
  isBase(hre) ? "OUSDMasterStrategyProxy" : "OUSDRemoteStrategyProxy";

const strategyType = (hre) =>
  isBase(hre) ? "MasterWOTokenStrategy" : "RemoteWOTokenStrategy";

const explorerUrl = (hre, txHash) =>
  isBase(hre)
    ? `https://sepolia.basescan.org/tx/${txHash}`
    : `https://sepolia.etherscan.io/tx/${txHash}`;

const getSigner = async (hre) => {
  const { deployerAddr } = await hre.getNamedAccounts();
  return hre.ethers.provider.getSigner(deployerAddr);
};

// --- Faucet info -----------------------------------------------------------

task(
  "tn:ousd:get-usdc",
  "Print Circle testnet USDC faucet URL (no programmatic drip available)"
).setAction(async (_, hre) => {
  const me = await (await getSigner(hre)).getAddress();
  console.log(
    `Testnet USDC isn't programmatically drippable. Mint via Circle's faucet:`
  );
  console.log(`  https://faucet.circle.com`);
  console.log(`Your address: ${me}`);
  console.log(`USDC on ${hre.network.name}: ${usdcAddr(hre)}`);
});

// --- Pool funding ----------------------------------------------------------

task(
  "tn:ousd:fund-pool",
  "Top up the strategy's ETH op-pool (CCTP fees are USDC-side, ETH still needed for tx gas)"
)
  .addParam("amount", "ETH amount in ether units (e.g. 0.02)")
  .setAction(async ({ amount }, hre) => {
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const amt = ethers.utils.parseEther(amount);
    const target = (await hre.deployments.get(strategyName(hre))).address;
    console.log(
      `Sending ${ethers.utils.formatEther(amt)} ETH → ${strategyName(
        hre
      )} ${target}...`
    );
    const tx = await signer.sendTransaction({ to: target, value: amt });
    const rcpt = await tx.wait();
    console.log(`  ${explorerUrl(hre, rcpt.transactionHash)}`);
    console.log(
      `Op-pool now: ${ethers.utils.formatEther(
        await ethers.provider.getBalance(target)
      )} ETH`
    );
  });

// --- Flow 1: Yield channel --------------------------------------------------

task(
  "tn:ousd:fund-master",
  "Transfer USDC to Master proxy. Prereq for tn:ousd:deposit."
)
  .addParam("amount", "USDC amount (e.g. 1.5)")
  .setAction(async ({ amount }, hre) => {
    requireNetwork(hre, "baseSepolia");
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const me = await signer.getAddress();
    const amt = parseUsdc(amount);
    const usdc = new ethers.Contract(usdcAddr(hre), ERC20_ABI, signer);
    const myBal = await usdc.balanceOf(me);
    if (myBal.lt(amt)) {
      throw new Error(
        `You only have ${fmt(myBal)} USDC (need ${fmt(
          amt
        )}). Get more from https://faucet.circle.com`
      );
    }
    const master = (await hre.deployments.get("OUSDMasterStrategyProxy"))
      .address;
    console.log(`Transferring ${fmt(amt)} USDC → Master ${master}...`);
    const tx = await usdc.transfer(master, amt);
    const rcpt = await tx.wait();
    console.log(`  ${explorerUrl(hre, rcpt.transactionHash)}`);
    console.log(`Master USDC balance: ${fmt(await usdc.balanceOf(master))}`);
  });

task(
  "tn:ousd:deposit",
  "MockOUSDbVault.callDeposit(master, USDC, amount) → fires Master → Remote DEPOSIT"
)
  .addParam("amount", "USDC amount to deposit")
  .setAction(async ({ amount }, hre) => {
    requireNetwork(hre, "baseSepolia");
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const amt = parseUsdc(amount);
    const masterAddr = (await hre.deployments.get("OUSDMasterStrategyProxy"))
      .address;
    const vaultAddr = (await hre.deployments.get("MockOUSDbVault")).address;
    const usdc = new ethers.Contract(usdcAddr(hre), ERC20_ABI, signer);
    const masterUsdc = await usdc.balanceOf(masterAddr);
    if (masterUsdc.lt(amt)) {
      throw new Error(
        `Master only has ${fmt(masterUsdc)} USDC (need ${fmt(
          amt
        )}). Run tn:ousd:fund-master first.`
      );
    }
    const vault = await ethers.getContractAt(
      "MockOTokenVault",
      vaultAddr,
      signer
    );
    const tx = await vault.callDeposit(masterAddr, usdcAddr(hre), amt);
    const rcpt = await tx.wait();
    console.log(`Deposit triggered. ${explorerUrl(hre, rcpt.transactionHash)}`);
    console.log(
      `\nNext step (after ~13 min CCTP attestation):` +
        `\n  pnpm hardhat tn:ousd:cctp-relay --tx ${rcpt.transactionHash} --network sepolia`
    );
  });

task(
  "tn:ousd:withdraw",
  "MockOUSDbVault.callWithdraw → fires WITHDRAW_REQUEST on Master"
)
  .addParam("amount", "USDC amount to withdraw")
  .setAction(async ({ amount }, hre) => {
    requireNetwork(hre, "baseSepolia");
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const amt = parseUsdc(amount);
    const masterAddr = (await hre.deployments.get("OUSDMasterStrategyProxy"))
      .address;
    const vaultAddr = (await hre.deployments.get("MockOUSDbVault")).address;
    const vault = await ethers.getContractAt(
      "MockOTokenVault",
      vaultAddr,
      signer
    );
    const tx = await vault.callWithdraw(
      masterAddr,
      vaultAddr,
      usdcAddr(hre),
      amt
    );
    const rcpt = await tx.wait();
    console.log(
      `Withdraw request fired. ${explorerUrl(hre, rcpt.transactionHash)}`
    );
    console.log(
      `\nNext step (after ~13 min CCTP attestation):` +
        `\n  pnpm hardhat tn:ousd:cctp-relay --tx ${rcpt.transactionHash} --network sepolia`
    );
  });

task(
  "tn:ousd:trigger-claim",
  "Master.triggerClaim() — leg 2 of withdraw; tells Remote to claim queue and bridge USDC back"
).setAction(async (_, hre) => {
  requireNetwork(hre, "baseSepolia");
  const { ethers } = hre;
  const signer = await getSigner(hre);
  const masterAddr = (await hre.deployments.get("OUSDMasterStrategyProxy"))
    .address;
  const master = await ethers.getContractAt(
    "MasterWOTokenStrategy",
    masterAddr,
    signer
  );
  const tx = await master.triggerClaim();
  const rcpt = await tx.wait();
  console.log(`triggerClaim fired. ${explorerUrl(hre, rcpt.transactionHash)}`);
});

task(
  "tn:ousd:claim-withdraw",
  "Remote.claimRemoteWithdrawal() — permissionless, after OUSD vault delay"
).setAction(async (_, hre) => {
  requireNetwork(hre, "sepolia");
  const { ethers } = hre;
  const signer = await getSigner(hre);
  const remoteAddr = (await hre.deployments.get("OUSDRemoteStrategyProxy"))
    .address;
  const remote = await ethers.getContractAt(
    "RemoteWOTokenStrategy",
    remoteAddr,
    signer
  );
  const tx = await remote.claimRemoteWithdrawal();
  const rcpt = await tx.wait();
  console.log(
    `claimRemoteWithdrawal fired. ${explorerUrl(hre, rcpt.transactionHash)}`
  );
});

task(
  "tn:ousd:balance-check",
  "Master.requestBalanceCheck() — non-blocking yield-channel ping"
).setAction(async (_, hre) => {
  requireNetwork(hre, "baseSepolia");
  const { ethers } = hre;
  const signer = await getSigner(hre);
  const masterAddr = (await hre.deployments.get("OUSDMasterStrategyProxy"))
    .address;
  const master = await ethers.getContractAt(
    "MasterWOTokenStrategy",
    masterAddr,
    signer
  );
  const tx = await master.requestBalanceCheck();
  const rcpt = await tx.wait();
  console.log(`Balance check fired. ${explorerUrl(hre, rcpt.transactionHash)}`);
});

task(
  "tn:ousd:settle",
  "Master.requestSettlement() — folds bridgeAdjustment into remoteStrategyBalance"
).setAction(async (_, hre) => {
  requireNetwork(hre, "baseSepolia");
  const { ethers } = hre;
  const signer = await getSigner(hre);
  const masterAddr = (await hre.deployments.get("OUSDMasterStrategyProxy"))
    .address;
  const master = await ethers.getContractAt(
    "MasterWOTokenStrategy",
    masterAddr,
    signer
  );
  const tx = await master.requestSettlement();
  const rcpt = await tx.wait();
  console.log(`Settle fired. ${explorerUrl(hre, rcpt.transactionHash)}`);
});

// --- Flow 2: User onboarding + bridge channel ------------------------------

task("tn:ousd:mint-ousdb", "Mint OUSDb 1:1 from mock vault on Base Sepolia")
  .addParam("amount", "OUSDb amount in USDC units (e.g. 1.5)")
  .setAction(async ({ amount }, hre) => {
    requireNetwork(hre, "baseSepolia");
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const me = await signer.getAddress();
    const amt = parseUsdc(amount);
    const vaultAddr = (await hre.deployments.get("MockOUSDbVault")).address;
    const usdc = new ethers.Contract(usdcAddr(hre), ERC20_ABI, signer);
    const myBal = await usdc.balanceOf(me);
    if (myBal.lt(amt)) {
      throw new Error(
        `You only have ${fmt(myBal)} USDC. Faucet: https://faucet.circle.com`
      );
    }
    const allowance = await usdc.allowance(me, vaultAddr);
    if (allowance.lt(amt)) {
      console.log(`Approving vault for ${fmt(amt)} USDC...`);
      const tx = await usdc.approve(vaultAddr, amt);
      await tx.wait();
    }
    const vault = await ethers.getContractAt(
      "MockOTokenVault",
      vaultAddr,
      signer
    );
    const tx = await vault.mint(amt);
    const rcpt = await tx.wait();
    console.log(
      `Minted ${fmt(amt)} OUSDb. ${explorerUrl(hre, rcpt.transactionHash)}`
    );
    const oTokenAddr = (await hre.deployments.get("MockOUSDb")).address;
    const oToken = new ethers.Contract(oTokenAddr, ERC20_ABI, signer);
    console.log(`Your OUSDb balance: ${fmt(await oToken.balanceOf(me))}`);
  });

task("tn:ousd:redeem-ousdb", "Burn OUSDb 1:1 from mock vault, get USDC back")
  .addParam("amount", "OUSDb amount to redeem")
  .setAction(async ({ amount }, hre) => {
    requireNetwork(hre, "baseSepolia");
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const me = await signer.getAddress();
    const amt = parseUsdc(amount);
    const vaultAddr = (await hre.deployments.get("MockOUSDbVault")).address;
    const vault = await ethers.getContractAt(
      "MockOTokenVault",
      vaultAddr,
      signer
    );
    const tx = await vault.redeem(amt, amt);
    const rcpt = await tx.wait();
    console.log(
      `Redeemed ${fmt(amt)} OUSDb. ${explorerUrl(hre, rcpt.transactionHash)}`
    );
    const usdc = new ethers.Contract(usdcAddr(hre), ERC20_ABI, signer);
    console.log(`Your USDC balance: ${fmt(await usdc.balanceOf(me))}`);
  });

task("tn:ousd:mint-ousd", "Mint mOUSD 1:1 from mock vault on Sepolia")
  .addParam("amount", "OUSD amount")
  .setAction(async ({ amount }, hre) => {
    requireNetwork(hre, "sepolia");
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const me = await signer.getAddress();
    const amt = parseUsdc(amount);
    const vaultAddr = (await hre.deployments.get("MockOUSDVault")).address;
    const usdc = new ethers.Contract(usdcAddr(hre), ERC20_ABI, signer);
    const allowance = await usdc.allowance(me, vaultAddr);
    if (allowance.lt(amt)) {
      const tx = await usdc.approve(vaultAddr, amt);
      await tx.wait();
    }
    const vault = await ethers.getContractAt(
      "MockEthOTokenVault",
      vaultAddr,
      signer
    );
    const tx = await vault.mint(amt);
    const rcpt = await tx.wait();
    console.log(
      `Minted ${fmt(amt)} mOUSD. ${explorerUrl(hre, rcpt.transactionHash)}`
    );
    const oToken = new ethers.Contract(
      (await hre.deployments.get("MockOUSD")).address,
      ERC20_ABI,
      signer
    );
    console.log(`Your mOUSD balance: ${fmt(await oToken.balanceOf(me))}`);
  });

task(
  "tn:ousd:bridge-out",
  "bridgeOTokenToPeer — burns local OUSD, mints on the peer chain"
)
  .addParam("amount", "OUSD amount to bridge")
  .addOptionalParam(
    "recipient",
    "Address on peer chain. Defaults to caller (peer-parity address)."
  )
  .setAction(async ({ amount, recipient }, hre) => {
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const me = await signer.getAddress();
    const amt = parseUsdc(amount);
    const strategyAddr = (await hre.deployments.get(strategyName(hre))).address;
    const strategy = await ethers.getContractAt(
      strategyType(hre),
      strategyAddr,
      signer
    );
    const oTokenAddr = await strategy.oToken();
    const oToken = new ethers.Contract(oTokenAddr, ERC20_ABI, signer);
    const allowance = await oToken.allowance(me, strategyAddr);
    if (allowance.lt(amt)) {
      const tx = await oToken.approve(strategyAddr, amt);
      await tx.wait();
    }
    const to = recipient || me;
    // CCTP has no native send fee — call bridgeOTokenToPeer with value=0.
    const tx = await strategy.bridgeOTokenToPeer(amt, to, "0x", 0);
    const rcpt = await tx.wait();
    console.log(`Bridge-out fired. ${explorerUrl(hre, rcpt.transactionHash)}`);
    console.log(
      `\nNext step (after ~13 min CCTP attestation):` +
        `\n  pnpm hardhat tn:ousd:cctp-relay --tx ${
          rcpt.transactionHash
        } --network ${isBase(hre) ? "sepolia" : "baseSepolia"}`
    );
  });

// --- CCTP relay (manual delivery) ------------------------------------------

task(
  "tn:ousd:cctp-relay",
  "Fetch attestation from Iris-sandbox + call CCTPAdapter.relay on the destination chain"
)
  .addParam("tx", "Source-side tx hash that emitted the CCTP message(s)")
  .addOptionalParam(
    "srcDomain",
    "CCTP source domain. Defaults to peer of current network."
  )
  .setAction(async ({ tx, srcDomain }, hre) => {
    const { ethers } = hre;
    const signer = await getSigner(hre);

    // Default source domain = peer's CCTP domain (we're on the destination).
    const srcDomainNum =
      srcDomain !== undefined
        ? parseInt(srcDomain, 10)
        : isBase(hre)
        ? addresses.sepolia.CCTPDomainId
        : addresses.baseSepolia.CCTPDomainId;

    const url = `${IRIS_SANDBOX}/v2/messages/${srcDomainNum}?transactionHash=${tx}`;
    console.log(`Polling ${url}`);

    // Built-in fetch in Node 18+; no new dep.
    const fetchAttestation = async () => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Iris HTTP ${res.status}: ${await res.text()}`);
      }
      return res.json();
    };

    let messages;
    const MAX_TRIES = 30; // 30 * 30s = 15min
    for (let i = 1; i <= MAX_TRIES; i++) {
      const body = await fetchAttestation();
      const msgs = body?.messages || [];
      const ready = msgs.filter((m) => m.status === "complete");
      if (ready.length > 0) {
        messages = ready;
        console.log(
          `  ready: ${ready.length}/${msgs.length} message(s) after ${i * 30}s`
        );
        break;
      }
      console.log(
        `  attempt ${i}/${MAX_TRIES}: ${msgs.length} pending (${msgs
          .map((m) => m.status)
          .join(",")}) — sleeping 30s`
      );
      await new Promise((r) => setTimeout(r, 30000));
    }
    if (!messages) {
      throw new Error(`Timed out waiting for Iris attestation on ${tx}`);
    }

    const adapterAddr = (await hre.deployments.get("OUSDCCTPAdapter")).address;
    const adapter = await ethers.getContractAt(
      "CCTPAdapter",
      adapterAddr,
      signer
    );

    for (const m of messages) {
      const message = m.message;
      const attestation = m.attestation;
      console.log(
        `Relaying message (${message.slice(
          0,
          18
        )}...) via adapter ${adapterAddr}`
      );
      const txRelay = await adapter.relay(message, attestation);
      const rcpt = await txRelay.wait();
      console.log(`  ${explorerUrl(hre, rcpt.transactionHash)}`);
    }
    console.log(`Relayed ${messages.length} message(s).`);
  });

// --- Status ----------------------------------------------------------------

task(
  "tn:ousd:status",
  "Print OUSD V3 testnet state on the current network"
).setAction(async (_, hre) => {
  const { ethers } = hre;
  const signer = await getSigner(hre);
  const me = await signer.getAddress();
  const strategyAddr = (await hre.deployments.get(strategyName(hre))).address;
  const strategy = await ethers.getContractAt(
    strategyType(hre),
    strategyAddr,
    signer
  );

  const oTokenAddr = await strategy.oToken();
  const oToken = new ethers.Contract(oTokenAddr, ERC20_ABI, signer);
  const usdc = new ethers.Contract(usdcAddr(hre), ERC20_ABI, signer);

  const inbound = await strategy.inboundAdapter();
  const outbound = await strategy.outboundAdapter();

  console.log(`=== ${hre.network.name} (${strategyType(hre)} — OUSD V3) ===`);
  console.log(`Strategy proxy:    ${strategyAddr}`);
  console.log(`OToken:            ${oTokenAddr}`);
  console.log(`Inbound adapter:   ${inbound}`);
  console.log(`Outbound adapter:  ${outbound}`);
  console.log("");

  console.log(`-- Your account ${me} --`);
  console.log(
    `  ETH:        ${ethers.utils.formatEther(
      await ethers.provider.getBalance(me)
    )}`
  );
  console.log(`  USDC:       ${fmt(await usdc.balanceOf(me))}`);
  console.log(`  OToken:     ${fmt(await oToken.balanceOf(me))}`);
  console.log("");

  console.log(`-- Strategy state --`);
  console.log(`  USDC on strategy: ${fmt(await usdc.balanceOf(strategyAddr))}`);
  console.log(
    `  Op-pool (ETH):    ${ethers.utils.formatEther(
      await ethers.provider.getBalance(strategyAddr)
    )}`
  );
  if (isBase(hre)) {
    const m = strategy;
    console.log(
      `  remoteStrategyBalance: ${fmt(await m.remoteStrategyBalance())}`
    );
    console.log(
      `  bridgeAdjustment:      ${(await m.bridgeAdjustment()).toString()}`
    );
    console.log(`  pendingAmount:         ${fmt(await m.pendingAmount())}`);
    console.log(
      `  pendingWithdrawalAmt:  ${fmt(await m.pendingWithdrawalAmount())}`
    );
    console.log(
      `  lastYieldNonce:        ${(await m.lastYieldNonce()).toString()}`
    );
  } else {
    const r = strategy;
    console.log(
      `  bridgeAdjustment:      ${(await r.bridgeAdjustment()).toString()}`
    );
    console.log(`  queuedAmount:          ${fmt(await r.queuedAmount())}`);
    console.log(
      `  outstandingRequestId:  ${(await r.outstandingRequestId()).toString()}`
    );
    console.log(
      `  lastYieldNonce:        ${(await r.lastYieldNonce()).toString()}`
    );
  }
  console.log("");
  console.log(
    `CCTP attestations: ${IRIS_SANDBOX}/v2/messages/<srcDomain>?transactionHash=<tx>`
  );
});
