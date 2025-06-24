const { expect } = require("chai");

const { beaconChainFixture } = require("../_fixture");

describe("Beacon chain proofs", async () => {
  let fixture;
  beforeEach(async () => {
    fixture = await beaconChainFixture();
  });
  describe("Generalized index", () => {
    it("from height and index", async () => {
      const { beaconProofs } = fixture;
      expect(await beaconProofs.generalizeIndexSingle(0, 0)).eq(1);
      expect(await beaconProofs.generalizeIndexSingle(1, 0)).eq(2);
      expect(await beaconProofs.generalizeIndexSingle(1, 1)).eq(3);
      expect(await beaconProofs.generalizeIndexSingle(2, 0)).eq(4);
      expect(await beaconProofs.generalizeIndexSingle(2, 3)).eq(7);
      expect(await beaconProofs.generalizeIndexSingle(3, 0)).eq(8);
      expect(await beaconProofs.generalizeIndexSingle(3, 1)).eq(9);
      expect(await beaconProofs.generalizeIndexSingle(3, 2)).eq(10);
      expect(await beaconProofs.generalizeIndexSingle(3, 6)).eq(14);
      expect(await beaconProofs.generalizeIndexSingle(3, 7)).eq(15);
      expect(await beaconProofs.generalizeIndexSingle(6, 12)).eq(76);
    });
    it("balances container", async () => {
      const { beaconProofs } = fixture;

      expect(
        await await beaconProofs.generalizeIndex([
          {
            height: 6,
            index: 12,
          },
        ])
      ).eq(76);
    });
  });
});
