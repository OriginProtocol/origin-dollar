const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");
const { run } = require("hardhat");

const addresses = require("../../utils/addresses");
const { oethPoolLpPID } = require("../../utils/constants");
const { units, oethUnits, isCI } = require("../helpers");
const {
    aeroOETHAMOFixture,
} = require("../_fixture");

const log = require("../../utils/logger")("test:fork:oeth:metapool");

describe("ForkTest: OETH AMO Aerodrome Strategy", function () {
    this.timeout(0);
    // Retry up to 3 times on CI
    this.retries(isCI ? 3 : 0);

    let fixture;

    describe("wip", () => {
        beforeEach(async () => {
            fixture = await aeroOETHAMOFixture();
        });
        it("Should work", async () => {
            expect(2).to.equal(2);
        });
    })
});