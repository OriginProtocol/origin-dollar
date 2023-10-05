const { defaultFixture } = require("./_fixture");

exports.mochaGlobalSetup = async function () {
  await defaultFixture()
};
