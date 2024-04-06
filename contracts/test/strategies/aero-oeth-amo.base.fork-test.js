const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");
const { run } = require("hardhat");

const addresses = require("../../utils/addresses");
const { oethPoolLpPID } = require("../../utils/constants");
const { units, oethUnits, isCI } = require("../helpers");
const {
    aeroOETHAMOFixture,
} = require("../_fixture");

const log = require("../../utils/logger")("test:fork:aero-oeth:metapool");

describe("ForkTest: OETH AMO Aerodrome Strategy", function () {
    this.timeout(0);
    // Retry up to 3 times on CI
    this.retries(isCI ? 3 : 0);

    let fixture;

    describe("wip", () => {
        beforeEach(async () => {
            fixture = await aeroOETHAMOFixture();
        });
        it("Should have constants and immutables set", async () => {
            const { aerodromeEthStrategy } = fixture;

            expect(await aerodromeEthStrategy.MAX_SLIPPAGE()).to.equal(
                parseUnits("0.01", 18)
            );
            expect(await aerodromeEthStrategy.ETH_ADDRESS()).to.equal(addresses.ETH);

            expect(await aerodromeEthStrategy.aeroRouterAddress()).to.equal(
                addresses.base.aeroRouterAddress
            );
            expect(await aerodromeEthStrategy.aeroFactoryAddress()).to.equal(
                addresses.base.aeroFactoryAddress
            );
        });
        it("Should be able to check balance", async () => {
            const { weth, josh, aerodromeEthStrategy } = fixture;

            const balance = await aerodromeEthStrategy.checkBalance(weth.address);
            log(`check balance ${balance}`);
            expect(balance).gt(0);

            // This uses a transaction to call a view function so the gas usage can be reported.
            const tx = await aerodromeEthStrategy
                .connect(josh)
                .populateTransaction.checkBalance(weth.address);
            await josh.sendTransaction(tx);
        });
    })
});