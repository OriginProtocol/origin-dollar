const fs = require("fs");
const papa = require("papaparse");
const { ethers } = require("hardhat");


const parseCsv = (filePath) => {
  const csvFile = fs.readFileSync(filePath);
  const csvData = csvFile.toString();

  return new Promise((resolve) => {
    papa.parse(csvData, {
      header: true,
      complete: ({ data }) => {
        console.log("Complete", data.length, "records.");
        resolve(data);
      },
    });
  });
};

const hashFileContents = async (filePath) => {
  const csvFile = fs.readFileSync(filePath);
  const csvData = ethers.utils.toUtf8Bytes(csvFile.toString());

  return ethers.utils.keccak256(csvData)
}

module.exports = {
  parseCsv,
  hashFileContents
};
