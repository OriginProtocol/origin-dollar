/**
 * Testnet V3 operator tasks for Sepolia (Remote / wOETH) ⇄ Base Sepolia (Master / OETHb).
 *
 * Two flows:
 *   - Yield channel: BnM → Master → DEPOSIT message → Remote (mOETH → mWOETH for yield)
 *   - Bridge channel: OToken → bridgeOTokenToPeer → BRIDGE_OUT / BRIDGE_IN
 *
 * bridgeAsset is CCIP-BnM (Chainlink's burn-and-mint testnet token) because CCIP
 * testnet lanes don't whitelist WETH. Get BnM from the public drip() faucet.
 *
 * All tasks resolve contract addresses via deployments.get(...) and dispatch
 * by hre.network.name. Pass --network sepolia or --network baseSepolia.
 */
const { task } = require("hardhat/config");
const addresses = require("../utils/addresses");

const BNM_ABI = [
  "function drip(address to) external",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
];

const CCIP_EXPLORER = "https://ccip.chain.link/#/side-drawer/msg/";

// CCIP-BnM drip() always returns 1e18 per call.
const BNM_DRIP_UNIT = require("ethers").utils.parseEther("1");

// --- Helpers ---------------------------------------------------------------

const fmt = (bn) => `${require("ethers").utils.formatEther(bn)}`;

const requireNetwork = (hre, expected) => {
  if (hre.network.name !== expected) {
    throw new Error(
      `This task is for --network ${expected} (got ${hre.network.name})`
    );
  }
};

const isBase = (hre) => hre.network.name === "baseSepolia";

const bnmAddr = (hre) =>
  isBase(hre) ? addresses.baseSepolia.CCIPBnM : addresses.sepolia.CCIPBnM;

const strategyName = (hre) =>
  isBase(hre) ? "MasterWOTokenStrategyProxy" : "RemoteWOTokenStrategyProxy";

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

// Drip BnM until the caller has at least `needed`. drip() gives 1 BnM per call.
// Faucet has per-address per-day limits — if drip reverts we surface a hint.
const dripBnmIfShort = async (signer, bnm, needed) => {
  const me = await signer.getAddress();
  let bal = await bnm.balanceOf(me);
  if (bal.gte(needed)) return;
  const short = needed.sub(bal);
  const drips = short.add(BNM_DRIP_UNIT).sub(1).div(BNM_DRIP_UNIT).toNumber();
  console.log(
    `  Short ${fmt(short)} BnM — calling drip() ${drips}× (1 BnM per call)`
  );
  for (let i = 0; i < drips; i++) {
    try {
      const tx = await bnm.drip(me);
      await tx.wait();
    } catch (e) {
      console.log(
        `  drip() failed on call ${i + 1}/${drips}: ${e.message.split("\n")[0]}`
      );
      console.log(
        "  CCIP-BnM faucet has per-address rate limits. Try again later or use another wallet."
      );
      throw e;
    }
  }
  bal = await bnm.balanceOf(me);
  console.log(`  BnM balance now: ${fmt(bal)}`);
};

// --- Faucet ---------------------------------------------------------------

task(
  "tn:get-bnm",
  "Drip CCIP-BnM to caller. Faucet returns 1 BnM per call; --amount calls N times."
)
  .addOptionalParam("amount", "Number of drips (each = 1 BnM)", "1")
  .setAction(async ({ amount }, hre) => {
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const me = await signer.getAddress();
    const bnm = new ethers.Contract(bnmAddr(hre), BNM_ABI, signer);
    const n = parseInt(amount, 10);
    console.log(`Dripping ${n} BnM to ${me}...`);
    for (let i = 0; i < n; i++) {
      const tx = await bnm.drip(me);
      const rcpt = await tx.wait();
      console.log(
        `  drip ${i + 1}/${n}: ${explorerUrl(hre, rcpt.transactionHash)}`
      );
    }
    console.log(`BnM balance: ${fmt(await bnm.balanceOf(me))}`);
  });

// --- Flow 1: Yield channel --------------------------------------------------

task(
  "tn:fund-pool",
  "Top up the strategy's ETH op-pool (used to pay CCIP fees on outbound msgs)"
)
  .addParam("amount", "ETH amount in ether units (e.g. 0.02)")
  .setAction(async ({ amount }, hre) => {
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const amt = ethers.utils.parseEther(amount);
    const target = (await hre.deployments.get(strategyName(hre))).address;
    console.log(`Sending ${fmt(amt)} ETH → ${strategyName(hre)} ${target}...`);
    const tx = await signer.sendTransaction({ to: target, value: amt });
    const rcpt = await tx.wait();
    console.log(`  ${explorerUrl(hre, rcpt.transactionHash)}`);
    console.log(`Op-pool now: ${fmt(await ethers.provider.getBalance(target))}`);
  });

task(
  "tn:fund-master",
  "Drip BnM if short, transfer BnM to Master proxy. Prereq for tn:deposit."
)
  .addParam("amount", "BnM amount in ether units (e.g. 0.1)")
  .setAction(async ({ amount }, hre) => {
    requireNetwork(hre, "baseSepolia");
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const amt = ethers.utils.parseEther(amount);
    const bnm = new ethers.Contract(bnmAddr(hre), BNM_ABI, signer);
    await dripBnmIfShort(signer, bnm, amt);
    const master = (await hre.deployments.get("MasterWOTokenStrategyProxy"))
      .address;
    console.log(`Transferring ${fmt(amt)} BnM → Master ${master}...`);
    const tx = await bnm.transfer(master, amt);
    const rcpt = await tx.wait();
    console.log(`  ${explorerUrl(hre, rcpt.transactionHash)}`);
    console.log(`Master BnM balance: ${fmt(await bnm.balanceOf(master))}`);
  });

task(
  "tn:deposit",
  "MockOETHbVault.callDeposit(master, bnm, amount) → fires Master → Remote DEPOSIT"
)
  .addParam("amount", "Deposit amount in ether units")
  .setAction(async ({ amount }, hre) => {
    requireNetwork(hre, "baseSepolia");
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const amt = ethers.utils.parseEther(amount);
    const masterAddr = (await hre.deployments.get("MasterWOTokenStrategyProxy"))
      .address;
    const vaultAddr = (await hre.deployments.get("MockOETHbVault")).address;
    const bnm = new ethers.Contract(bnmAddr(hre), BNM_ABI, signer);
    const masterBnm = await bnm.balanceOf(masterAddr);
    if (masterBnm.lt(amt)) {
      throw new Error(
        `Master only has ${fmt(masterBnm)} BnM (need ${fmt(
          amt
        )}). Run tn:fund-master first.`
      );
    }
    const vault = await ethers.getContractAt(
      "MockOTokenVault",
      vaultAddr,
      signer
    );
    const tx = await vault.callDeposit(masterAddr, bnmAddr(hre), amt);
    const rcpt = await tx.wait();
    console.log(`Deposit triggered. ${explorerUrl(hre, rcpt.transactionHash)}`);
    console.log(`Track CCIP: ${CCIP_EXPLORER}${rcpt.transactionHash}`);
  });

task(
  "tn:withdraw",
  "MockOETHbVault.callWithdraw → fires WITHDRAW_REQUEST on Master"
)
  .addParam("amount", "Withdraw amount in ether units")
  .setAction(async ({ amount }, hre) => {
    requireNetwork(hre, "baseSepolia");
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const amt = ethers.utils.parseEther(amount);
    const masterAddr = (await hre.deployments.get("MasterWOTokenStrategyProxy"))
      .address;
    const vaultAddr = (await hre.deployments.get("MockOETHbVault")).address;
    const vault = await ethers.getContractAt(
      "MockOTokenVault",
      vaultAddr,
      signer
    );
    const tx = await vault.callWithdraw(
      masterAddr,
      vaultAddr,
      bnmAddr(hre),
      amt
    );
    const rcpt = await tx.wait();
    console.log(
      `Withdraw request fired. ${explorerUrl(hre, rcpt.transactionHash)}`
    );
    console.log(`Track CCIP: ${CCIP_EXPLORER}${rcpt.transactionHash}`);
  });

task(
  "tn:trigger-claim",
  "Master.triggerClaim() — leg 2 of withdraw; tells Remote to claim queue and bridge BnM back"
).setAction(async (_, hre) => {
  requireNetwork(hre, "baseSepolia");
  const { ethers } = hre;
  const signer = await getSigner(hre);
  const masterAddr = (await hre.deployments.get("MasterWOTokenStrategyProxy"))
    .address;
  const master = await ethers.getContractAt(
    "MasterWOTokenStrategy",
    masterAddr,
    signer
  );
  const tx = await master.triggerClaim();
  const rcpt = await tx.wait();
  console.log(`triggerClaim fired. ${explorerUrl(hre, rcpt.transactionHash)}`);
  console.log(`Track CCIP: ${CCIP_EXPLORER}${rcpt.transactionHash}`);
});

task(
  "tn:claim-withdraw",
  "Remote.claimRemoteWithdrawal() — permissionless, after OETH vault delay"
).setAction(async (_, hre) => {
  requireNetwork(hre, "sepolia");
  const { ethers } = hre;
  const signer = await getSigner(hre);
  const remoteAddr = (await hre.deployments.get("RemoteWOTokenStrategyProxy"))
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
  "tn:balance-check",
  "Master.requestBalanceCheck() — non-blocking yield-channel ping"
).setAction(async (_, hre) => {
  requireNetwork(hre, "baseSepolia");
  const { ethers } = hre;
  const signer = await getSigner(hre);
  const masterAddr = (await hre.deployments.get("MasterWOTokenStrategyProxy"))
    .address;
  const master = await ethers.getContractAt(
    "MasterWOTokenStrategy",
    masterAddr,
    signer
  );
  const tx = await master.requestBalanceCheck();
  const rcpt = await tx.wait();
  console.log(`Balance check fired. ${explorerUrl(hre, rcpt.transactionHash)}`);
  console.log(`Track CCIP: ${CCIP_EXPLORER}${rcpt.transactionHash}`);
});

task(
  "tn:settle",
  "Master.requestSettlement() — folds bridgeAdjustment into remoteStrategyBalance"
).setAction(async (_, hre) => {
  requireNetwork(hre, "baseSepolia");
  const { ethers } = hre;
  const signer = await getSigner(hre);
  const masterAddr = (await hre.deployments.get("MasterWOTokenStrategyProxy"))
    .address;
  const master = await ethers.getContractAt(
    "MasterWOTokenStrategy",
    masterAddr,
    signer
  );
  const tx = await master.requestSettlement();
  const rcpt = await tx.wait();
  console.log(`Settle fired. ${explorerUrl(hre, rcpt.transactionHash)}`);
  console.log(`Track CCIP: ${CCIP_EXPLORER}${rcpt.transactionHash}`);
});

// --- Flow 2: User onboarding + bridge channel ------------------------------

task(
  "tn:mint-oethb",
  "Drip BnM if short, mint OETHb 1:1 from mock vault (production-like)"
)
  .addParam("amount", "OETHb amount in ether units")
  .setAction(async ({ amount }, hre) => {
    requireNetwork(hre, "baseSepolia");
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const me = await signer.getAddress();
    const amt = ethers.utils.parseEther(amount);
    const vaultAddr = (await hre.deployments.get("MockOETHbVault")).address;
    const bnm = new ethers.Contract(bnmAddr(hre), BNM_ABI, signer);
    await dripBnmIfShort(signer, bnm, amt);

    const allowance = await bnm.allowance(me, vaultAddr);
    if (allowance.lt(amt)) {
      console.log(`Approving vault for ${fmt(amt)} BnM...`);
      const tx = await bnm.approve(vaultAddr, amt);
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
      `Minted ${fmt(amt)} OETHb. ${explorerUrl(hre, rcpt.transactionHash)}`
    );

    const oTokenAddr = (await hre.deployments.get("MockOETHb")).address;
    const oToken = new ethers.Contract(oTokenAddr, ERC20_ABI, signer);
    console.log(`Your OETHb balance: ${fmt(await oToken.balanceOf(me))}`);
  });

task("tn:redeem-oethb", "Burn OETHb 1:1 from mock vault, get BnM back")
  .addParam("amount", "OETHb amount to redeem in ether units")
  .setAction(async ({ amount }, hre) => {
    requireNetwork(hre, "baseSepolia");
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const me = await signer.getAddress();
    const amt = ethers.utils.parseEther(amount);
    const vaultAddr = (await hre.deployments.get("MockOETHbVault")).address;
    const vault = await ethers.getContractAt(
      "MockOTokenVault",
      vaultAddr,
      signer
    );
    const tx = await vault.redeem(amt, amt);
    const rcpt = await tx.wait();
    console.log(
      `Redeemed ${fmt(amt)} OETHb. ${explorerUrl(hre, rcpt.transactionHash)}`
    );
    const bnm = new ethers.Contract(bnmAddr(hre), BNM_ABI, signer);
    console.log(`Your BnM balance: ${fmt(await bnm.balanceOf(me))}`);
  });

task("tn:mint-oeth", "Drip BnM if short, mint mOETH 1:1 on Sepolia")
  .addParam("amount", "mOETH amount in ether units")
  .setAction(async ({ amount }, hre) => {
    requireNetwork(hre, "sepolia");
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const me = await signer.getAddress();
    const amt = ethers.utils.parseEther(amount);
    const vaultAddr = (await hre.deployments.get("MockOETHVault")).address;
    const bnm = new ethers.Contract(bnmAddr(hre), BNM_ABI, signer);
    await dripBnmIfShort(signer, bnm, amt);

    const allowance = await bnm.allowance(me, vaultAddr);
    if (allowance.lt(amt)) {
      const tx = await bnm.approve(vaultAddr, amt);
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
      `Minted ${fmt(amt)} mOETH. ${explorerUrl(hre, rcpt.transactionHash)}`
    );
    const oToken = new ethers.Contract(
      (await hre.deployments.get("MockOETH")).address,
      ERC20_ABI,
      signer
    );
    console.log(`Your mOETH balance: ${fmt(await oToken.balanceOf(me))}`);
  });

task(
  "tn:bridge-out",
  "bridgeOTokenToPeer — burns local OToken, mints on the peer chain"
)
  .addParam("amount", "OToken amount to bridge in ether units")
  .addOptionalParam(
    "recipient",
    "Address on peer chain. Defaults to caller (peer-parity address)."
  )
  .setAction(async ({ amount, recipient }, hre) => {
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const me = await signer.getAddress();
    const amt = ethers.utils.parseEther(amount);
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
      console.log(`Approving strategy for ${fmt(amt)} OToken...`);
      const tx = await oToken.approve(strategyAddr, amt);
      await tx.wait();
    }

    // Quote the outbound fee — mirror exactly what the strategy does internally
    // (see AbstractCrossChainV3Strategy._sendUserMessage):
    //   payload = packPayload(BRIDGE_OUT_or_IN, 0, body)
    //   body = encode(bridgeId, amount, recipient, callData, callGasLimit)
    //   quoteFee(address(0), 0, payload)  ← bridge channel is message-only
    //
    // AbstractAdapter.quoteFee reads laneConfig[msg.sender], so we MUST eth_call
    // from the strategy address to resolve the lane config. Spoofing the `from`
    // is fine — eth_call doesn't authenticate it.
    const outbound = await strategy.outboundAdapter();
    const BRIDGE_OUT_MSG = isBase(hre)
      ? 12 /* BRIDGE_OUT */
      : 11; /* BRIDGE_IN */
    const to = recipient || me;
    const dummyBridgeId = ethers.utils.hexZeroPad("0x01", 32);
    const body = ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint256", "address", "bytes", "uint32"],
      [dummyBridgeId, amt, to, "0x", 0]
    );
    const payload = ethers.utils.defaultAbiCoder.encode(
      ["uint32", "uint64", "bytes"],
      [BRIDGE_OUT_MSG, 0, body]
    );
    const adapterIface = new ethers.utils.Interface([
      "function quoteFee(address token, uint256 amount, bytes payload) view returns (uint256 fee, address feeToken, bool requiresExternalPayment)",
    ]);
    const callData = adapterIface.encodeFunctionData("quoteFee", [
      ethers.constants.AddressZero,
      0,
      payload,
    ]);
    let fee;
    try {
      const ret = await ethers.provider.call({
        from: strategyAddr,
        to: outbound,
        data: callData,
      });
      const decoded = adapterIface.decodeFunctionResult("quoteFee", ret);
      fee = decoded.fee;
    } catch (e) {
      console.log(
        "  quoteFee failed (unexpected); using 0.01 ETH default.",
        e.message.split("\n")[0]
      );
      fee = ethers.utils.parseEther("0.01");
    }
    // Small buffer (1.05x) for any nonce/bridgeId-induced variance in CCIP cost.
    fee = fee.mul(105).div(100);
    console.log(`Estimated fee (with 5% buffer): ${fmt(fee)} ETH`);

    const tx = await strategy.bridgeOTokenToPeer(amt, to, "0x", 0, {
      value: fee,
    });
    const rcpt = await tx.wait();
    console.log(`Bridge-out fired. ${explorerUrl(hre, rcpt.transactionHash)}`);
    console.log(`Track CCIP: ${CCIP_EXPLORER}${rcpt.transactionHash}`);
  });

// --- Status ----------------------------------------------------------------

task("tn:status", "Print V3 testnet state on the current network").setAction(
  async (_, hre) => {
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
    const bnm = new ethers.Contract(bnmAddr(hre), BNM_ABI, signer);

    const inbound = await strategy.inboundAdapter();
    const outbound = await strategy.outboundAdapter();

    console.log(`=== ${hre.network.name} (${strategyType(hre)}) ===`);
    console.log(`Strategy proxy:    ${strategyAddr}`);
    console.log(`OToken:            ${oTokenAddr}`);
    console.log(`Inbound adapter:   ${inbound}`);
    console.log(`Outbound adapter:  ${outbound}`);
    console.log("");

    const myEth = await ethers.provider.getBalance(me);
    console.log(`-- Your account ${me} --`);
    console.log(`  ETH:       ${fmt(myEth)}`);
    console.log(`  BnM:       ${fmt(await bnm.balanceOf(me))}`);
    console.log(`  OToken:    ${fmt(await oToken.balanceOf(me))}`);
    console.log("");

    console.log(`-- Strategy state --`);
    console.log(
      `  BnM on strategy:  ${fmt(await bnm.balanceOf(strategyAddr))}`
    );
    console.log(
      `  Op-pool (ETH):    ${fmt(
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
        `  lastBalanceCheckTs:    ${(
          await m.lastBalanceCheckTimestamp()
        ).toString()}`
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
        `  outstandingRequestId:  ${(
          await r.outstandingRequestId()
        ).toString()}`
      );
      console.log(
        `  lastYieldNonce:        ${(await r.lastYieldNonce()).toString()}`
      );
    }
    console.log("");
    console.log(`Track CCIP messages: ${CCIP_EXPLORER}<tx-hash>`);
  }
);
