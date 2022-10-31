const { ethers } = require('hardhat');
const { network } = require('hardhat-2.12.0');


/**
 * OUSD-governance helper scripts
*/

/**
 * Deploy a contract by name without constructor arguments
 */
 async function deploy(contractName) {
    let Contract = await ethers.getContractFactory(contractName);
    return await Contract.deploy({gasLimit: 8888888});
}

/**
 * Deploy a contract by name with constructor arguments
 */
async function deployArgs(contractName, ...args) {
    let Contract = await ethers.getContractFactory(contractName);
    return await Contract.deploy(...args, {gasLimit: 8888888});
}

/**
 * Deploy a contract with abi
 */
 async function deployWithAbi(contract, deployer, ...args) {
    let Factory = new ethers.ContractFactory(contract.abi, contract.bytecode, deployer);
    return await Factory.deploy(...args, {gasLimit: 8888888});
}

/**
 * Deploy a contract by name without constructor arguments
 * Link contract to a library address
 */
 async function deployAndLink(contractName, libraryName, libraryAddress) {
    const params = {
        libraries: {
            [libraryName]: libraryAddress
        }
    }
    let Contract = await ethers.getContractFactory(contractName, params);
    return await Contract.deploy({gasLimit: 8888888});
}



async function verifyContractNoArgs(address) {
    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: [],
        });
    } catch (err) {
        console.log('error while verifying contract:', err);
    }
}

async function verifyContractWithArgs(address, ...args) {
    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: [...args],
        });
    } catch (err) {
        console.log('error while verifying contract:', err);
    }
}

async function verifyContractWithArgsAndName(address, contractName, ...args) {
    try {
        await hre.run("verify:verify", {
            address: address,
            contract: contractName,
            constructorArguments: [...args],
        });
    } catch (err) {
        console.log('error while verifying contract:', err);
    }
}

/**
 * Impersonate an ETH account and set it's balance
 * @param {String} address account address
 * @returns 
 */
async function impersonate(address) {
    await setBalance(address, bnDecimal(10));
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [address]}
    )
    return await ethers.getSigner(address)
}

/**
 * Get block by number
 * @param {Number} number 
 * @returns 
 */
async function getBlock(number) {
    return await network.provider.send("eth_getBlockByNumber", 
        ['0x' + number.toString(16), false]);
}

async function getLastBlock() {
    return await network.provider.send("eth_getBlockByNumber", ["latest", false]);
}

async function getBlockNumber() {
    let block = await getLastBlock();
    return parseInt(block.number, 16);
}

async function getLastBlockTimestamp() {
    let block = await getLastBlock();
    return block.timestamp;
}


/**
 * Increase time in Hardhat Network
 */
 async function increaseTime(time) {
    await network.provider.send("evm_increaseTime", [time]);
    await network.provider.send("evm_mine");
}

/**
 * Mine several blocks in network
 * Method for hardhat >= 2.9.0
 * @param {Number} blockCount how many blocks to mine
 */
// async function mineBlocks(blockCount) {
//     await network.provider.send("hardhat_mine", ['0x' + blockCount.toString(16)]);
// }

/**
 * Mine several blocks in network
 * @param {Number} blockCount how many blocks to mine
 */
async function mineBlocks(blockCount) {
    for(let i = 0 ; i < blockCount ; ++i) {
        await network.provider.send("evm_mine");
    }
}

/**
 * Set an address ETH balance to an amount
 * @param {*} address 
 */
 async function setBalance(address, amount) {
    await network.provider.send("hardhat_setBalance", [
      address,
      amount.toHexString().replace("0x0", "0x"),
    ]);
}

/**
 * Get address to claim lockups
 * @returns 
 */
async function getMerkleClaimer() {
    return await impersonate('0x8dea6Ef7767e0D6ae7Dd9D144E514D7DFAe75B36');
}

function toHex(str) {
    return Buffer.from(str, 'utf8')
}

/**
 * Return BigNumber
 */
 function bn(amount) {
    return new ethers.BigNumber.from(amount);
}

/**
 * Returns bignumber scaled to 18 decimals
 */
function bnDecimal(amount) {
    let decimal = Math.pow(10, 18);
    let decimals = bn(decimal.toString());
    return bn(amount).mul(decimals);
}

/**
 * Returns bignumber scaled to custom amount of decimals
 */
 function bnDecimals(amount, _decimals) {
    let decimal = Math.pow(10, _decimals);
    let decimals = bn(decimal.toString());
    return bn(amount).mul(decimals);
}

// Constants

const testMerkleData = {
    "merkle_root": "0x362525d914142d116c518263e481c6cbe968a44638f9faeffb01c11a84008b96",
    "token_total": "0x0813f3978f89409844000000",
    "claims": {
        "0x4370823e0453BAe9F6B6b790daA7D02Fd158719f": {
            "index": 0,
            "amount": "0x019d971e4fe8401e74000000",
            "proof": [
                "0x701183f5e8c42cecd237685c83e965d69a618d1380bc159998b2dc1ed2f550fd",
                "0x6829150a3b7e2535bd9cce778cf05ead15bd6f3cc5bb39a9dc4d756a0a64ece7",
                "0xcb8bd9ca540f4b1c63f13d7ddfec54ab24715f49f9a3640c1ccf9f548a896554"
            ]
        },
        "0x8dea6Ef7767e0D6ae7Dd9D144E514D7DFAe75B36": {
            "index": 1,
            "amount": "0x019d971e4fe8401e74000000",
            "proof": [
                "0xc06e0d1a35007d9401ab64b2edb9cd0a674ebcce35acbf4c93e1193f99df35d3",
                "0xa7856630eacdc74c4f5891e97ab7da00642f08cbea4d7de72ac28c18fafe01d3",
                "0xcb8bd9ca540f4b1c63f13d7ddfec54ab24715f49f9a3640c1ccf9f548a896554"
            ]
        },
        "0xE8F8B89D408C236f3FbA18898eAd345070252abA": {
            "index": 2,
            "amount": "0x019d971e4fe8401e74000000",
            "proof": [
                "0xab335d7d89102b2079834202d020e69982db42f074920e742d4841e7e3bd6255",
                "0xa7856630eacdc74c4f5891e97ab7da00642f08cbea4d7de72ac28c18fafe01d3",
                "0xcb8bd9ca540f4b1c63f13d7ddfec54ab24715f49f9a3640c1ccf9f548a896554"
            ]
        },
        "0xc6A45cdD6892039FcDB0bbf3867eF33ba46F90c5": {
            "index": 3,
            "amount": "0x019d971e4fe8401e74000000",
            "proof": [
                "0x3afd4908f772f66e5085cdc6d8e90d755db208b6bdad5ced4650046aadb3e7c2",
                "0x6829150a3b7e2535bd9cce778cf05ead15bd6f3cc5bb39a9dc4d756a0a64ece7",
                "0xcb8bd9ca540f4b1c63f13d7ddfec54ab24715f49f9a3640c1ccf9f548a896554"
            ]
        },
        "0xdfae2c5962514417f805776a7f280F5084a0f06C": {
            "index": 4,
            "amount": "0x019d971e4fe8401e74000000",
            "proof": [
                "0x710ba1b8e900d3f58896f4429e3a384faa1a5aa2a02d33b838d39ec7f7075601"
            ]
        }
    }
}

const merkleProof = [
    '0xC06E0D1A35007D9401AB64B2EDB9CD0A674EBCCE35ACBF4C93E1193F99DF35D3',
    '0xA7856630EACDC74C4F5891E97AB7DA00642F08CBEA4D7DE72AC28C18FAFE01D3',
    '0xCB8BD9CA540F4B1C63F13D7DDFEC54AB24715F49F9A3640C1CCF9F548A896554',
]

const invalidMerkleProof = [
    '0xC06E0D1A35007D9401AB64B2EDB9CD0A674EBCCE35ACBF4C93E1193F99DF35D2',
    '0xA7856630EACDC74C4F5891E97AB7DA00642F08CBEA4D7DE72AC28C18FAFE01D3',
    '0xCB8BD9CA540F4B1C63F13D7DDFEC54AB24715F49F9A3640C1CCF9F548A896554',
]

const week = 7 * 24 * 60 * 60;

module.exports = { deploy, deployArgs, deployWithAbi, deployAndLink,
    verifyContractNoArgs, verifyContractWithArgs, verifyContractWithArgsAndName,
    increaseTime, mineBlocks, setBalance, bn, bnDecimal, bnDecimals,
    getLastBlock, getBlockNumber, getLastBlockTimestamp, toHex, getBlock,
    impersonate, getMerkleClaimer,
    testMerkleData, merkleProof, invalidMerkleProof, week }