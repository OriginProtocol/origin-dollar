/* Output analysis 15.1. by sparrowDom reimbursements hash: 0x7be111312b7921a476d7428f6f43555684ac06739acfc01341649dfbc5f4bac3
 * OUSD required by contract: 1696579.792469218771921386 OUSD
 * OUSD transfered to contract: 1696590
 * OUSD remaining in the contract after all claims: 84.554630679871612032
 * 
 * Accounts failing to claim because they were non payable:
 * - 0x4853c9A7CB8f42a87dF28148F3380E35d8728043
 * - 0x4b5b754032d442831F32643f04cD6e4571865189
 * - 0x6Ffe8F6d47afb19F12f46e5499a182a99C4D3BEf
 * - 0x6684977bBED67e101BB80Fc07fCcfba655c0a64F
 *
 * Accounts with larger OUSD then expected because they had pre-existing OUSD in wallet
 * 0x145D8BB322FF71eF8ecefc35F584993DF071bc92 -> 200 OUSD
 * 0x198d03Db13A0b2b3e28F59857AEC54Bf4C96DFF8 -> 2500,17 OUSD
 * 0x297289405fAF325d416658E93D93d0ade229528C -> 4150,28 OUSD
 * 0x2ed7aFA17473e17Ac59908F088b4371D28585476 -> 53,31 OUSD
 * 0x467927774B59F7cB023863b07960669f958EC19a -> 15223,54 OUSD
 * 0x50b71FA550D646F3B0942a4c16bAed0260b77039 -> 1508,11 OUSD
 * 0x67F3A569C1E86d64a767D4776294b0e1C4819768 -> 1081,31 OUSD
 * 0x6b11bDA202802402f6E92a426e440BA6Abb01EE6 -> 1330,21 OUSD
 * 0x78b514bAd0299826c1Bc9409e5c3db7Ece9CA404 -> 9236,01 OUSD
 * 0x867A57860fD469eD97aB80cB6A097a30dc128caA -> 1046 OUSD
 * 0x89eBCb7714bd0D2F33ce3a35C12dBEB7b94af169 -> 70 OUSD
 * 0x8A9b7145bc7F7b2A530F188a4Fc933F66F5cfe12 -> 18268 OUSD
 * 0x96FEb7b6F808dd2BBd09c9E5ccdE77caBd58d019 -> 13464 OUSD
 * 0xB52A42f0C0032bcBe8Ee448654F47E423CcbB3a6 -> 4005 OUSD
 * 0xC8Aa3D70e3B235e6Be04dB0d9653002139f03408 -> 100 OUSD
 * 0xD26d9CFE022332f830BBc4D54885f25C867e4885 -> 151 OUSD
 * 0xd39B6849d2e1dB20BAb50dd7A4F3e0882c744404 -> 10000 OUSD
 * 0xD85A569F3C26f81070544451131c742283360400 -> 3 OUSD
 * 0xf9303877F107F5cd2cB0654b6d7A6D749FA03856 -> 14936 OUSD
 * 0xFD9E6005187F448957a0972a7d0C0A6dA2911236 -> 1.5 OUSD
 *
 * 
 *
 */
const reimbursementsLocation = "./scripts/staking/reimbursements.csv";

async function isAdjusterLocked(taskArguments, hre) {
  const compensationClaims = await hre.ethers.getContract("CompensationClaims");
  console.log(!!(await compensationClaims.isAdjusterLocked()));
}

async function checkOUSDBalances() {
  const { compensationSync } = require("../scripts/compensation/compensationSync");
  const compensationClaims = await hre.ethers.getContract("CompensationClaims");
  await compensationSync(compensationClaims, reimbursementsLocation);
}

async function claimAllAsUser(taskArguments, hre) {
  const { parseCsv } = require("../utils/fileSystem");
  const ethers = hre.ethers
  const compensationClaims = await hre.ethers.getContract("CompensationClaims");
  const csv = await parseCsv(reimbursementsLocation);

  let claimed = 0;
  let errored = 0;
  for (let i = 0; i < csv.length; i++) {
    const account = csv[i].address
    /* Failed because accounts not funded
     * - 0x4853c9A7CB8f42a87dF28148F3380E35d8728043
     * - 0x4b5b754032d442831F32643f04cD6e4571865189
     * - 0x6Ffe8F6d47afb19F12f46e5499a182a99C4D3BEf
     * - 0x6684977bBED67e101BB80Fc07fCcfba655c0a64F
     */
    try {
      await hre.network.provider.request({method: "hardhat_impersonateAccount",params: [account]});
      const accountSigner = await hre.ethers.provider.getSigner(account);
      await compensationClaims.connect(accountSigner).claim(account)
      if (i % 10 === 0) {
        console.log(`${i} accounts claimed`);
      }
      claimed++;
    } catch (e) {
      const problematicAccounts = ['0x4853c9A7CB8f42a87dF28148F3380E35d8728043','0x4b5b754032d442831F32643f04cD6e4571865189','0x6Ffe8F6d47afb19F12f46e5499a182a99C4D3BEf','0x6684977bBED67e101BB80Fc07fCcfba655c0a64F']
      errored++;
      if (problematicAccounts.includes(account)) {
        console.log(`Expected failure of ${account}`)
      } else {
        console.error("New problematic account please investigate: ", account, e);
      }
    } 
  }

  console.log(`Claimed accounts: ${claimed}, errros: ${errored}`);
}

async function fundCompAccountsWithEth(taskArguments, hre) {
  const { parseCsv } = require("../utils/fileSystem");
  const ethers = hre.ethers
  const reimbursementsLocation = "./scripts/staking/reimbursements.csv";
  const csv = await parseCsv(reimbursementsLocation);
  const signers = await ethers.getSigners();
  let funded = 0;
  let errored = 0;

  for (let i = 0; i < csv.length; i++) {
    const account = csv[i].address
    /* Can not fund the following contracts from the csv: 
     * - 0x4853c9A7CB8f42a87dF28148F3380E35d8728043
     * - 0x4b5b754032d442831F32643f04cD6e4571865189
     * - 0x6Ffe8F6d47afb19F12f46e5499a182a99C4D3BEf
     * - 0xeae57ce9cc1984F202e15e038B964bb8bdF7229a
     * - 0x6684977bBED67e101BB80Fc07fCcfba655c0a64F
     */
    try {
      await signers[4].sendTransaction({ to: account, from: signers[4].address, value: ethers.utils.parseEther("0.2")});
      if (i % 10 === 0) {
        console.log(`${i} accounts funded`)
      }
      funded++;
    } catch (e) {
      const problematicAccounts = ['0x4853c9A7CB8f42a87dF28148F3380E35d8728043','0x4b5b754032d442831F32643f04cD6e4571865189','0x6Ffe8F6d47afb19F12f46e5499a182a99C4D3BEf','0xeae57ce9cc1984F202e15e038B964bb8bdF7229a','0x6684977bBED67e101BB80Fc07fCcfba655c0a64F']
      errored++;
      if (problematicAccounts.includes(account)) {
        console.log(`Expected failure of ${account}`)
      } else {
        console.error("New problematic account please investigate: ", account, e);
      }      
    }
  }
  console.log(`Funded accounts: ${funded}, errros: ${errored}`);
}

module.exports = {
  isAdjusterLocked,
  fundCompAccountsWithEth,
  claimAllAsUser,
  checkOUSDBalances
}