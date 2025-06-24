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
    it("BeaconBlock.slot", async () => {
      const { beaconProofs } = fixture;

      expect(
        await await beaconProofs.generalizeIndex([
          {
            height: 3,
            index: 0,
          },
        ])
      ).eq(8);
    });
    it("BeaconBlock.parentRoot", async () => {
      const { beaconProofs } = fixture;

      expect(
        await await beaconProofs.generalizeIndex([
          {
            height: 3,
            index: 2,
          },
        ])
      ).eq(10);
    });
    it("BeaconBlock.body", async () => {
      const { beaconProofs } = fixture;

      expect(
        await await beaconProofs.generalizeIndex([
          {
            height: 3,
            index: 4,
          },
        ])
      ).eq(12);
    });
    it("BeaconBlock.BeaconBlockBody.randaoReveal", async () => {
      const { beaconProofs } = fixture;

      expect(
        await await beaconProofs.generalizeIndex([
          {
            height: 3,
            index: 4,
          },
          {
            height: 4,
            index: 0,
          },
        ])
      ).eq(192);
    });
    it("BeaconBlock.BeaconState.balances", async () => {
      const { beaconProofs } = fixture;

      expect(
        await await beaconProofs.generalizeIndex([
          {
            height: 3,
            index: 3,
          },
          {
            height: 6,
            index: 12,
          },
        ])
      ).eq(716);
    });
    it("BeaconBlock.body.executionPayload.blockNumber", async () => {
      const { beaconProofs } = fixture;

      expect(
        await await beaconProofs.generalizeIndex([
          {
            height: 3,
            index: 4,
          },
          {
            height: 4,
            index: 9,
          },
          {
            height: 5,
            index: 6,
          },
        ])
      ).eq(6438);
    });
  });
  describe("verify", () => {
    it("balances container to beacon root", async () => {
      const { beaconProofs } = fixture;

      const beaconRoot =
        "0x5afbdb19dd02b8d6bf10ee1722753b4a687326f1e7c3a4515ec47be3599b0474";
      const balancesContainerLeaf =
        "0xa4181bd72c96848c06c64a28ce7c21563b6063f289ec27d2b5f05aae4dfdb57d";
      const proof =
        "0x4938a396a5a5651cdeab2dbc058f866ebcda5fd4fc85a152f22dba474c009791732bb29b9703de0515129d79481b879a3dd9123eeffe7bf8afd4aaff84378560ab5cfe225d99d908dd717ced212090862faf3d42ef6d49b90e5a3d53a13a187ba1ba6d4a2373a34ace4c3bdff56faaf6dc7e93b538bab62355581ae2b679cf30b9db93bd03ab076a7c7dce90b2fcd3162c71977e7e58a31e1ca4a0dded313be333f54b1fbc27a269a843a4d3838e0013984cc884b7a88e4d7f528a1c9a76c98c41dd7ebb8c56a217d6881589c4e09ce0055bea097be50e2dcaa07757da3df8bb1561936559cd736ba1d1802b048e118c414a17c48ff04189f0b8df768d599c9171c990856b4ce5cd0c635561d221a760c5be68a43c7a26b82c92800a16e05ddc";

      await beaconProofs.verifyBalancesContainer(
        beaconRoot,
        balancesContainerLeaf,
        proof
      );
    });
  });
});
