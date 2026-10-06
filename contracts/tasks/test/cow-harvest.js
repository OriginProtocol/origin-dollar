const { expect } = require("chai");
const { BigNumber, ethers } = require("ethers");

const {
  HARVESTERS,
  EIP1271_MAGIC_VALUE,
  appDataHash,
  applySlippage,
  botSignHash,
  buildOrder,
  encodeEip1271Signature,
  harvestToken,
} = require("../lib/cowHarvest");
const { getDigestSigner } = require("../lib/signer");

const ORDER_TUPLE =
  "tuple(address sellToken, address buyToken, address receiver, " +
  "uint256 sellAmount, uint256 buyAmount, uint32 validTo, bytes32 appData, " +
  "uint256 feeAmount, bytes32 kind, bool partiallyFillable, " +
  "bytes32 sellTokenBalance, bytes32 buyTokenBalance)";

const SELL = "0xD533a949740bb3306d119CC777fa900bA034cd52";
const BUY = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const RECEIVER = "0xE75D77B1865Ae93c7eaa3040B038D7aA7BC02F70";
const HARVESTER = "0xD400341aEfED0BC75176714cFdE82e8BDAA2D3b8";
const APP_DATA = JSON.stringify({ version: "1.3.0" });

const silentLog = { info() {}, warn() {}, error() {} };

const sampleOrder = () =>
  buildOrder({
    sellToken: SELL,
    buyToken: BUY,
    receiver: RECEIVER,
    sellAmount: BigNumber.from(1000),
    buyAmount: BigNumber.from(990),
    validTo: 1800000000,
    appData: APP_DATA,
  });

/**
 * Stand-in for the harvester: recovers like `getMessageSigner` and answers
 * `isValidSignature` with the magic value only when the recovered signer is
 * the configured bot, so the off-chain signing is exercised end to end.
 */
const fakeHarvester = ({ bot, enabled = true, minSellAmount = 0 }) => {
  const digest = ethers.utils.id("order digest");
  const recover = (d, r, s, v) =>
    ethers.utils.recoverAddress(botSignHash(d), { r, s, v });
  return {
    address: HARVESTER,
    hashed: [],
    async tokenConfigs() {
      return [enabled, BigNumber.from(minSellAmount)];
    },
    async hashOrder(order) {
      this.hashed.push(order);
      return digest;
    },
    async getMessageSigner(d, r, s, v) {
      return recover(d, r, s, v);
    },
    async isValidSignature(d, signature) {
      const [, r, s, v] = ethers.utils.defaultAbiCoder.decode(
        [ORDER_TUPLE, "bytes32", "bytes32", "uint8"],
        signature
      );
      return recover(d, r, s, v).toLowerCase() === bot.toLowerCase()
        ? EIP1271_MAGIC_VALUE
        : "0xffffffff";
    },
  };
};

const fakeCowApi = ({ quoteBuyAmount = "1000000", uid = "0xuid" } = {}) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    if (url.endsWith("/quote")) {
      return {
        ok: true,
        json: async () => ({ quote: { buyAmount: quoteBuyAmount } }),
      };
    }
    return { ok: true, text: async () => `"${uid}"` };
  };
  return { calls, fetchImpl };
};

const digestSignerFor = (wallet) => ({
  address: wallet.address,
  async signDigest(digest) {
    return ethers.utils.splitSignature(wallet._signingKey().signDigest(digest));
  },
});

const harvestCtx = (overrides) => ({
  balanceOf: async () => BigNumber.from(5000),
  apiBase: "https://cow.test/api/v1",
  appData: APP_DATA,
  slippageBps: 50,
  validTo: 1800000000,
  receiver: RECEIVER,
  buyToken: BUY,
  dryrun: false,
  log: silentLog,
  ...overrides,
});

describe("cowHarvest", function () {
  describe("order building", function () {
    it("applies slippage in bps, rounding down", function () {
      expect(applySlippage(BigNumber.from(10000), 50).toString()).to.equal(
        "9950"
      );
      expect(applySlippage(BigNumber.from(999), 50).toString()).to.equal("994");
    });

    it("hashes JSON appData and passes a 32-byte hex through", function () {
      expect(appDataHash(APP_DATA)).to.equal(
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(APP_DATA))
      );
      const hex = ethers.utils.id("x");
      expect(appDataHash(hex)).to.equal(hex);
    });

    it("builds a fill-or-kill erc20 sell order with no fee", function () {
      const order = sampleOrder();
      expect(order.kind).to.equal(ethers.utils.id("sell"));
      expect(order.sellTokenBalance).to.equal(ethers.utils.id("erc20"));
      expect(order.buyTokenBalance).to.equal(ethers.utils.id("erc20"));
      expect(order.feeAmount.isZero()).to.equal(true);
      expect(order.partiallyFillable).to.equal(false);
      expect(order.appData).to.equal(appDataHash(APP_DATA));
      expect(order.validTo).to.equal(1800000000);
    });
  });

  describe("signing", function () {
    it("signs the COWSWAP-prefixed digest, not an EIP-191 message", function () {
      const digest = ethers.utils.id("digest");
      expect(botSignHash(digest)).to.equal(
        ethers.utils.solidityKeccak256(
          ["bytes", "bytes32"],
          [ethers.utils.toUtf8Bytes("\x19COWSWAP order digest:\n32"), digest]
        )
      );
      expect(botSignHash(digest)).to.not.equal(
        ethers.utils.hashMessage(ethers.utils.arrayify(digest))
      );
    });

    it("produces a signature the contract's ecrecover accepts", async function () {
      // Fixed key so the vector is stable across runs.
      const wallet = new ethers.Wallet(
        ethers.utils.id("cow harvester test key")
      );
      const digest = ethers.utils.id("digest");
      const sig = await digestSignerFor(wallet).signDigest(botSignHash(digest));
      expect([27, 28]).to.include(sig.v);
      expect(ethers.utils.recoverAddress(botSignHash(digest), sig)).to.equal(
        wallet.address
      );
    });

    it("encodes abi.encode(Order, r, s, v) for isValidSignature", function () {
      const order = sampleOrder();
      const sig = { r: ethers.utils.id("r"), s: ethers.utils.id("s"), v: 27 };
      const [decoded, r, s, v] = ethers.utils.defaultAbiCoder.decode(
        [ORDER_TUPLE, "bytes32", "bytes32", "uint8"],
        encodeEip1271Signature(order, sig)
      );
      expect(decoded.sellToken).to.equal(SELL);
      expect(decoded.buyAmount.toString()).to.equal("990");
      expect(decoded.kind).to.equal(order.kind);
      expect([r, s, v]).to.deep.equal([sig.r, sig.s, 27]);
    });

    it("getDigestSigner signs raw digests with DEPLOYER_PK", async function () {
      const saved = { ...process.env };
      const wallet = ethers.Wallet.createRandom();
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI;
      delete process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI;
      process.env.DEPLOYER_PK = wallet.privateKey;
      try {
        const signer = await getDigestSigner();
        expect(signer.address).to.equal(wallet.address);
        const digest = ethers.utils.id("digest");
        const sig = await signer.signDigest(digest);
        expect(ethers.utils.recoverAddress(digest, sig)).to.equal(
          wallet.address
        );
      } finally {
        process.env = saved;
      }
    });
  });

  describe("harvestToken", function () {
    const token = { address: SELL, symbol: "CRV" };
    let bot;

    beforeEach(function () {
      bot = ethers.Wallet.createRandom();
    });

    it("skips a disabled token without quoting", async function () {
      const api = fakeCowApi();
      const result = await harvestToken(
        harvestCtx({
          harvester: fakeHarvester({ bot: bot.address, enabled: false }),
          signer: digestSignerFor(bot),
          fetchImpl: api.fetchImpl,
        }),
        token
      );
      expect(result).to.deep.equal({
        status: "skipped",
        reason: "token disabled",
      });
      expect(api.calls).to.have.length(0);
    });

    it("skips a balance below minSellAmount", async function () {
      const api = fakeCowApi();
      const result = await harvestToken(
        harvestCtx({
          harvester: fakeHarvester({ bot: bot.address, minSellAmount: 6000 }),
          signer: digestSignerFor(bot),
          fetchImpl: api.fetchImpl,
        }),
        token
      );
      expect(result.status).to.equal("skipped");
      expect(api.calls).to.have.length(0);
    });

    it("quotes the full balance and posts a signed eip1271 order", async function () {
      const api = fakeCowApi({ quoteBuyAmount: "1000000", uid: "0xabc" });
      const harvester = fakeHarvester({ bot: bot.address });
      const result = await harvestToken(
        harvestCtx({
          harvester,
          signer: digestSignerFor(bot),
          fetchImpl: api.fetchImpl,
        }),
        token
      );
      expect(result).to.deep.equal({ status: "posted", uid: "0xabc" });

      const [quote, post] = api.calls;
      expect(quote.url).to.equal("https://cow.test/api/v1/quote");
      expect(quote.body).to.include({
        sellToken: SELL,
        buyToken: BUY,
        receiver: RECEIVER,
        from: HARVESTER,
        kind: "sell",
        sellAmountBeforeFee: "5000",
        priceQuality: "verified",
        appData: APP_DATA,
      });
      expect(post.url).to.equal("https://cow.test/api/v1/orders");
      expect(post.body).to.include({
        sellAmount: "5000",
        buyAmount: "995000",
        feeAmount: "0",
        validTo: 1800000000,
        signingScheme: "eip1271",
        from: HARVESTER,
        appData: APP_DATA,
        partiallyFillable: false,
      });
      expect(harvester.hashed[0].buyAmount.toString()).to.equal("995000");
    });

    it("does not post when the harvester rejects the signature", async function () {
      const api = fakeCowApi();
      const notBot = ethers.Wallet.createRandom();
      let error;
      try {
        await harvestToken(
          harvestCtx({
            harvester: fakeHarvester({ bot: bot.address }),
            signer: digestSignerFor(notBot),
            fetchImpl: api.fetchImpl,
          }),
          token
        );
      } catch (e) {
        error = e;
      }
      expect(error?.message).to.match(/rejects the signature/);
      expect(api.calls.map((c) => c.url)).to.deep.equal([
        "https://cow.test/api/v1/quote",
      ]);
    });

    it("signs but does not post on a dry run, even before setBot", async function () {
      const api = fakeCowApi();
      const notYetBot = ethers.Wallet.createRandom();
      const result = await harvestToken(
        harvestCtx({
          harvester: fakeHarvester({ bot: bot.address }),
          signer: digestSignerFor(notYetBot),
          fetchImpl: api.fetchImpl,
          dryrun: true,
        }),
        token
      );
      expect(result).to.deep.equal({ status: "dryrun" });
      expect(api.calls).to.have.length(1);
    });
  });

  describe("config", function () {
    it("pins the harvester routes", function () {
      const { get } = require("../lib/deployments");
      const { initNetwork } = require("../lib/network");
      const saved = process.env.MAINNET_PROVIDER_URL;
      process.env.MAINNET_PROVIDER_URL = "http://127.0.0.1:8545";
      initNetwork("mainnet");
      try {
        const address = (id) => get(HARVESTERS[id].deployment).address;
        expect(address("ousd")).to.equal(
          "0xD400341aEfED0BC75176714cFdE82e8BDAA2D3b8"
        );
        expect(address("oeth")).to.equal(
          "0xEd56C8bd58612a5283BA55B11ff6418831b20862"
        );
        expect(address("ogn")).to.equal(
          "0x637C509383Ec7Da55C19a3Dbf3227C1Bb8A89151"
        );
      } finally {
        if (saved === undefined) delete process.env.MAINNET_PROVIDER_URL;
        else process.env.MAINNET_PROVIDER_URL = saved;
      }

      const lower = (a) => a.toLowerCase();
      expect(lower(HARVESTERS.ousd.receiver)).to.equal(
        "0xe75d77b1865ae93c7eaa3040b038d7aa7bc02f70"
      );
      expect(lower(HARVESTERS.oeth.receiver)).to.equal(
        "0x39254033945aa2e4809cc2977e7087bee48bd7ab"
      );
      expect(lower(HARVESTERS.ogn.receiver)).to.equal(
        "0x7609c88e5880e934dd3a75bcfef44e31b1badb8b"
      );
      expect(HARVESTERS.ogn.sellTokens.map((t) => t.symbol)).to.deep.equal([
        "OETH",
        "WETH",
        "OUSD",
        "USDe",
      ]);
      expect(lower(HARVESTERS.ogn.sellTokens[3].address)).to.equal(
        "0x4c9edd5852cd905f086c759e8383e09bff1e68b3"
      );
      expect(lower(HARVESTERS.ousd.sellTokens[1].address)).to.equal(
        "0x58d97b57bb95320f9a05dc918aef65434969c2b2"
      );
    });
  });
});
