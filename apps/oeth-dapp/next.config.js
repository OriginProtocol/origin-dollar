const { withNx } = require('@nrwl/next/plugins/with-nx');
const { i18n } = require('./next-i18next.config.js');

/**
 * @type {import('@nrwl/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {
    svgr: false,
  },
  i18n,
};

module.exports = withNx(nextConfig);
