# Compensation Claims Sync

This script takes a CSV of compensation addresses and amounts in, and ensures that the compensation claims contract matches the contents of the CSV. It checks the balance of each address on the contract, then checks the contract total. If any account (or all) claims need to be updated, it sends those changes up as batched updates. Afterwords it verifies that the work is complete.


### How to verify

    export HARDHAT_NETWORK=mainnet
    node scripts/compensation/compensationSync.js --data-file=scripts/staking/reimbursements.csv

### How to sync/upload

The contract goveror **must**  have called `unlockAdjuster` on the contract before this is run, and the governor should call `lockAdjuster` after the data is set on the blockchain.

    export HARDHAT_NETWORK=mainnet
    export DEPLOYER_PK=<pk>
    node scripts/compensation/compensationSync.js --data-file=scripts/staking/reimbursements.csv --do-it


### Sample output  

    Reading file sample_amounts.csv
    🟢 1/8 0x13e563534de51317226cdc399a4e8738ac57350a A: 137662713135307680000 E: 137662713135307680000
    🟢 2/8 0xee9d544867761ec5b57c35c88d74e4c030d2052b A: 384596579867380850000 E: 384596579867380850000
    🟢 3/8 0x6af802985ce00f3d1d5519e0e857c316d0dc4de0 A: 3279010848852101000000 E: 3279010848852101000000
    🟢 4/8 0x36d3e026c2072ff562fc544b7d6603fbb31cfdef A: 1397635715839862200 E: 1397635715839862200
    🟢 5/8 0x88d5e0bf26fd4316a035e3bb5e9c2ff84f9578fa A: 1796109763318210000 E: 1796109763318210000
    🔴 6/8 0x3cb51b6999c2fb154594f36ccea858bfb2f89c3a A: 0 E: 5917074780233763000
    🔴 7/8 0x0e845014ae14032128da88b98ff67c0e864d6ba2 A: 0 E: 13298534922759556000
    🔴 8/8 0x175e2b7546438a671fb8164044edcc82cfb8da89 A: 0 E: 9533819895774144000
    Expected total 3833213316932715065200
    Actual total   3804463887333947602200
    Uploading batch 1 of 1
    Uploading batch of 3 accounts. Total: 28749429598767463000
    Sent. tx hash: 0xff5588a9d94acc19e2d17804746482dd4d0c60a383430ce29c4b61b5b6dcaa90
    Waiting for confirmation...
    Propose tx confirmed. Gas usage 104041
    🟢 1/8 0x13e563534de51317226cdc399a4e8738ac57350a A: 137662713135307680000 E: 137662713135307680000
    🟢 2/8 0xee9d544867761ec5b57c35c88d74e4c030d2052b A: 384596579867380850000 E: 384596579867380850000
    🟢 3/8 0x6af802985ce00f3d1d5519e0e857c316d0dc4de0 A: 3279010848852101000000 E: 3279010848852101000000
    🟢 4/8 0x36d3e026c2072ff562fc544b7d6603fbb31cfdef A: 1397635715839862200 E: 1397635715839862200
    🟢 5/8 0x88d5e0bf26fd4316a035e3bb5e9c2ff84f9578fa A: 1796109763318210000 E: 1796109763318210000
    🟢 6/8 0x3cb51b6999c2fb154594f36ccea858bfb2f89c3a A: 5917074780233763000 E: 5917074780233763000
    🟢 7/8 0x0e845014ae14032128da88b98ff67c0e864d6ba2 A: 13298534922759556000 E: 13298534922759556000
    🟢 8/8 0x175e2b7546438a671fb8164044edcc82cfb8da89 A: 9533819895774144000 E: 9533819895774144000
    Expected total 3833213316932715065200
    Actual total   3833213316932715065200
    Upload successful
