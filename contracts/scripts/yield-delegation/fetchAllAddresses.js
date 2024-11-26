require("dotenv").config();
const postgres = require("postgres");
const ethers = require("ethers");
const fs = require('fs');

const sql = postgres(process.env.SQUID_DB_URL);

const OETH_ADDRESS = "0x856c4efb76c1d1ae02e20ceb03a2a6a08b0b8dc3";
const OUSD_ADDRESS = "0x2a8e1e676ec238d8a992307b495b45b3feaa5e86";

async function getAddresses(oTokenAddress) {
  const batchSize = 5000;
  let offset = 0;
  const allAddresses = [];

  while (true) {
    const batch = await sql`
      SELECT DISTINCT account 
      FROM erc20_balance 
      WHERE address = ${oTokenAddress}
      ORDER BY account
      LIMIT ${batchSize} 
      OFFSET ${offset}
    `;

    if (batch.length === 0) break;

    batch.forEach(row => allAddresses.push(row.account));
    offset += batchSize;
    
    console.log(`Processed ${allAddresses.length} unique addresses so far...`);
  }

  console.log(`Total ${oTokenAddress == OETH_ADDRESS ? "OETH" : "OUSD"} unique addresses found: ${allAddresses.length}`);

  // // Write addresses to CSV
  // const csvContent = allAddresses.join('\n');
  // fs.writeFileSync('unique_addresses.csv', csvContent);
  // console.log('Addresses written to unique_addresses.csv');

  return allAddresses;
}

async function getCredits(oToken, userAddress, blockNumber) {}

async function getBalance(oToken, userAddress, blockNumber) {}

async function processOTokenAddresses(oTokenAddress) {
  const addresses = await getAddresses(oTokenAddress);


}

async function main() {
  const oethAddresses = await getAddresses(OETH_ADDRESS);
  const ousdAddresses = await getAddresses(OUSD_ADDRESS);

  // const allAddresses = [...oethAddresses, ...ousdAddresses];

  // console.log(allAddresses.length);

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
