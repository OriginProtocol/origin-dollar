const fs = require("fs");
const papa = require("papaparse");

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

module.exports = parseCsv;
