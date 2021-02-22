const fs = require("fs");
const papa = require("papaparse");
const util = require("util");
const readdir = util.promisify(fs.readdir);

const parseCsv = async (filePath) => {
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

const hashFileContents = (filePath) => {
  const { ethers } = require("hardhat");
  const csvFile = fs.readFileSync(filePath);
  const csvData = ethers.utils.toUtf8Bytes(csvFile.toString());

  return ethers.utils.keccak256(csvData);
};

const getFilesInFolder = async (folderName) => {
  return await readdir(folderName);
};

const getDeployScripts = async () => {
  const filesDir = `${__dirname}/../deploy`;
  const filesList = await getFilesInFolder(filesDir);
  const files = {};

  filesList.forEach((file) => {
    const orderNumber = parseInt(file.split("_")[0]);
    files[orderNumber] = {
      fullPath: `${filesDir}/${file}`,
      orderNumber,
      file,
    };
  });

  return files;
};

const getLastDeployScript = async () => {
  const files = await getDeployScripts();
  const lastDeployNumber = Math.max(
    ...Object.keys(files).map((key) => parseInt(key))
  );
  return files[lastDeployNumber];
};

module.exports = {
  parseCsv,
  hashFileContents,
  getDeployScripts,
  getLastDeployScript,
  getFilesInFolder,
};
