const path = require('path')
const pinataSDK = require('@pinata/sdk')
const fs = require('fs')
const { ethers, Contract } = require('ethers')
const IPFS = require("ipfs")

require('dotenv').config({
  path: path.resolve(__dirname, '../local.env'),
})

/* Might become obsolete if we start using Fleek */
const main = async () => {
  const pinata = pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);

  const pinataAuth = await pinata.testAuthentication()
  console.log("Pinata auth response: ", pinataAuth)

  const pinResponse = await pinata.pinFromFS('./out', {
    pinataMetadata: {
        name: 'ousd-dapp',
    },
    pinataOptions: {
        cidVersion: 0
    }
  })

  if (pinResponse.IpfsHash) {
    console.log(`Dapp uploaded to IPFS hash: https://ipfs.io/ipfs/${pinResponse.IpfsHash}/`)
  } else {
    throw new Error(`Error uploading to Pinata ipfs: ${pinResponsee}`)
  }

}

(async () => {
  await main()
})();