/**
 * Testnet V3 operator tasks for Sepolia (Remote / wOETH) ⇄ Base Sepolia (Master / OETHb).
 *
 * Two flows:
 *   - Yield channel: WETH → Master → DEPOSIT message → Remote (mOETH → mWOETH for yield)
 *   - Bridge channel: OToken → bridgeOTokenToPeer → BRIDGE_OUT / BRIDGE_IN
 *
 * All tasks resolve contract addresses via deployments.get(...) and dispatch
 * by hre.network.name. Pass --network sepolia or --network baseSepolia.
 */
const { task } = require("hardhat/config");
const addresses = require("../utils/addresses");

const WETH_ABI = [
  "function deposit() payable",
  "function withdraw(uint256)",
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

const wethAddr = (hre) =>
  isBase(hre) ? addresses.baseSepolia.WETH : addresses.sepolia.WETH;

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

const wrapEthIfShort = async (signer, weth, needed) => {
  const bal = await weth.balanceOf(await signer.getAddress());
  if (bal.gte(needed)) return;
  const short = needed.sub(bal);
  console.log(`  Wrapping ${fmt(short)} ETH → WETH...`);
  const tx = await weth.deposit({ value: short });
  await tx.wait();
};

// --- Flow 1: Yield channel --------------------------------------------------

task(
  "tn:fund-master",
  "Wrap ETH if short, transfer WETH to Master proxy. Prereq for tn:deposit."
)
  .addParam("amount", "WETH amount in ether units (e.g. 0.1)")
  .setAction(async ({ amount }, hre) => {
    requireNetwork(hre, "baseSepolia");
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const amt = ethers.utils.parseEther(amount);
    const weth = new ethers.Contract(wethAddr(hre), WETH_ABI, signer);
    await wrapEthIfShort(signer, weth, amt);
    const master = (await hre.deployments.get("MasterWOTokenStrategyProxy"))
      .address;
    console.log(`Transferring ${fmt(amt)} WETH → Master ${master}...`);
    const tx = await weth.transfer(master, amt);
    const rcpt = await tx.wait();
    console.log(`  ${explorerUrl(hre, rcpt.transactionHash)}`);
    console.log(`Master WETH balance: ${fmt(await weth.balanceOf(master))}`);
  });

task(
  "tn:deposit",
  "MockOETHbVault.callDeposit(master, weth, amount) → fires Master → Remote DEPOSIT"
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
    const weth = new ethers.Contract(wethAddr(hre), WETH_ABI, signer);
    const masterWeth = await weth.balanceOf(masterAddr);
    if (masterWeth.lt(amt)) {
      throw new Error(
        `Master only has ${fmt(masterWeth)} WETH (need ${fmt(
          amt
        )}). Run tn:fund-master first.`
      );
    }
    const vault = await ethers.getContractAt(
      "MockOTokenVault",
      vaultAddr,
      signer
    );
    const tx = await vault.callDeposit(masterAddr, wethAddr(hre), amt);
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
      wethAddr(hre),
      amt
    );
    const rcpt = await tx.wait();
    console.log(
      `Withdraw request fired. ${explorerUrl(hre, rcpt.transactionHash)}`
    );
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
  "Wrap ETH if short, mint OETHb 1:1 from mock vault (production-like)"
)
  .addParam("amount", "OETHb amount in ether units")
  .setAction(async ({ amount }, hre) => {
    requireNetwork(hre, "baseSepolia");
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const me = await signer.getAddress();
    const amt = ethers.utils.parseEther(amount);
    const vaultAddr = (await hre.deployments.get("MockOETHbVault")).address;
    const weth = new ethers.Contract(wethAddr(hre), WETH_ABI, signer);
    await wrapEthIfShort(signer, weth, amt);

    const allowance = await weth.allowance(me, vaultAddr);
    if (allowance.lt(amt)) {
      console.log(`Approving vault for ${fmt(amt)} WETH...`);
      const tx = await weth.approve(vaultAddr, amt);
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

task("tn:redeem-oethb", "Burn OETHb 1:1 from mock vault, get WETH back")
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
    const weth = new ethers.Contract(wethAddr(hre), WETH_ABI, signer);
    console.log(`Your WETH balance: ${fmt(await weth.balanceOf(me))}`);
  });

task("tn:mint-oeth", "Wrap ETH if short, mint mOETH 1:1 on Sepolia")
  .addParam("amount", "mOETH amount in ether units")
  .setAction(async ({ amount }, hre) => {
    requireNetwork(hre, "sepolia");
    const { ethers } = hre;
    const signer = await getSigner(hre);
    const me = await signer.getAddress();
    const amt = ethers.utils.parseEther(amount);
    const vaultAddr = (await hre.deployments.get("MockOETHVault")).address;
    const weth = new ethers.Contract(wethAddr(hre), WETH_ABI, signer);
    await wrapEthIfShort(signer, weth, amt);

    const allowance = await weth.allowance(me, vaultAddr);
    if (allowance.lt(amt)) {
      const tx = await weth.approve(vaultAddr, amt);
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

    // Quote the outbound fee
    const outbound = await strategy.outboundAdapter();
    const adapter = await ethers.getContractAt(
      "IBridgeAdapter",
      outbound,
      signer
    );
    // Encoding the payload exactly matches what _sendUserTokensAndMessage does;
    // for the quote we ask the adapter with an empty payload approximation (the
    // fee is conservative — overpaying slightly is fine, dust stays on adapter).
    const dummyPayload = "0x" + "00".repeat(96);
    let fee;
    try {
      const q = await adapter.quoteFee(oTokenAddr, amt, dummyPayload);
      fee = q.fee || q[0];
    } catch (e) {
      console.log(
        "  quoteFee failed; using 0.01 ETH conservative default. Reason:",
        e.message.split("\n")[0]
      );
      fee = ethers.utils.parseEther("0.01");
    }
    console.log(`Estimated fee: ${fmt(fee)} ETH`);

    const to = recipient || me;
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
    const weth = new ethers.Contract(wethAddr(hre), WETH_ABI, signer);

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
    console.log(`  WETH:      ${fmt(await weth.balanceOf(me))}`);
    console.log(`  OToken:    ${fmt(await oToken.balanceOf(me))}`);
    console.log("");

    console.log(`-- Strategy state --`);
    console.log(
      `  WETH on strategy: ${fmt(await weth.balanceOf(strategyAddr))}`
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
