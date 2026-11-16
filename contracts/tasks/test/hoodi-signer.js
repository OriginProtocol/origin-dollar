const { expect } = require("chai");
const { resolveKmsRelayerId } = require("../../utils/signersNoHardhat");

describe("Dedicated Hoodi signer", () => {
  let previous;
  beforeEach(() => {
    previous = process.env.HOODI_KMS_RELAYER_ID;
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.HOODI_KMS_RELAYER_ID;
    else process.env.HOODI_KMS_RELAYER_ID = previous;
  });
  it("fails closed without the testnet key", () => {
    delete process.env.HOODI_KMS_RELAYER_ID;
    expect(() => resolveKmsRelayerId({ chainId: 560048 })).to.throw(
      "HOODI_KMS_RELAYER_ID"
    );
  });
  it("uses the testnet key even when a production override is supplied", () => {
    process.env.HOODI_KMS_RELAYER_ID = "hoodi-test-key";
    expect(
      resolveKmsRelayerId({ chainId: 560048, relayerId: "production-key" })
    ).to.equal("hoodi-test-key");
  });
  it("keeps other chains on their existing signer", () => {
    process.env.HOODI_KMS_RELAYER_ID = "hoodi-test-key";
    expect(
      resolveKmsRelayerId({ chainId: 1, relayerId: "production-key" })
    ).to.equal("production-key");
  });
});
