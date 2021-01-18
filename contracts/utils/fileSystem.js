const fs = require("fs");
const papa = require("papaparse");
const { ethers } = require("hardhat");


const parseCsv = async filePath => {
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

const hashFileContents = filePath => {
  const csvFile = fs.readFileSync(filePath);
  const csvData = ethers.utils.toUtf8Bytes(csvFile.toString());

  return ethers.utils.keccak256(csvData)
}

module.exports = {
  parseCsv,
  hashFileContents
};
