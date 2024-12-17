require("dotenv").config();
const postgres = require("postgres");
const ethers = require("ethers");
const fs = require('fs');

const sql = postgres(process.env.SQUID_DB_URL);

const OETH_ADDRESS = "0x856c4efb76c1d1ae02e20ceb03a2a6a08b0b8dc3";
const OUSD_ADDRESS = "0x2a8e1e676ec238d8a992307b495b45b3feaa5e86";
const SUPER_OETH_ADDRESS = "0xdbfefd2e8460a6ee4955a68582f85708baea60a3";

async function getAddressesAndBalances(oTokenAddress, maxBlockNumber, csvFileName) {
  const batchSize = 5000;
  let offset = 0;
  const allAddresses = [];

  const blockSmallerOrEq = blockNumber => sql` AND block_number <= ${ blockNumber }`
  while (true) {
    console.log(`Running query batchSize: ${batchSize}, offset: ${offset}`);
    const batch = await sql`
      SELECT b.account, b.balance, b.block_number FROM (
        SELECT DISTINCT ON (account) account, balance, block_number
        FROM erc20_balance
        WHERE address = ${oTokenAddress}
        ${
          maxBlockNumber > 0 ?
            blockSmallerOrEq(maxBlockNumber) :
            sql``
        }
        ORDER BY account, block_number DESC
        LIMIT ${batchSize} 
        OFFSET ${offset}
      ) b WHERE balance > 0
    `;

    if (batch.length === 0) break;

    batch.forEach((row) => {
      allAddresses.push([row.account, row.balance, row.block_number].join(','))
      //console.log(`account: ${row.account} balance: ${row.balance} block_number: ${row.block_number}`)
    });
    offset += batchSize;
    
    console.log(`Processed ${allAddresses.length} unique addresses so far...`);
  }

  console.log(`Total ${oTokenAddress == OETH_ADDRESS ? "OETH" : "OUSD"} unique addresses found: ${allAddresses.length}`);

  // // Write addresses to CSV
  const csvContent = allAddresses.join('\n');
  fs.writeFileSync(csvFileName, csvContent);
  console.log(`Addresses and balances written to ${csvFileName}`);

  return allAddresses;
}

async function main() {
  const oethAddresses = await getAddressesAndBalances(OETH_ADDRESS, 0, 'oethBalances.csv');
  const ousdAddresses = await getAddressesAndBalances(OUSD_ADDRESS, 0, 'ousdBalances.csv');
  const soethAddresses = await getAddressesAndBalances(SUPER_OETH_ADDRESS, 0, 'soethBalances.csv');
}

main()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
