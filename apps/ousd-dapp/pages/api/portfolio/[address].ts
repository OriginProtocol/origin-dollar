import { contracts } from '@originprotocol/web3';
import { find } from 'lodash';

const fetchOETHPortfolio = (req, res) => {
  try {
    const { token } = req.query;

    const found = find(
      contracts.mainnet,
      ({ address }) => address?.toLowerCase() === token.toLowerCase()
    );

    if (!found) {
      return res.json({
        token,
      });
    }

    const { symbol } = found;

    if (symbol === 'OUSD') {
      return res.json({
        token,
        symbol,
        displayValues: ['lifetimeEarnings', 'pendingYield'],
        lifetimeEarnings: 0,
        pendingYield: 0,
      });
    } else if (symbol === 'WOUSD') {
      return res.json({
        token,
        symbol,
        displayValues: ['currentValue', 'pendingYield'],
        currentValue: 0,
        pendingYield: 0,
      });
    }

    return res.json({
      token,
    });
  } catch (error) {
    return res.json({
      error: error.message,
    });
  }
};

const handler = async (req, res) => {
  const { method } = req;
  switch (method) {
    case 'GET':
      return fetchOETHPortfolio(req, res);
    default:
      res.setHeader('Allow', ['POST', 'OPTIONS']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
};

export default handler;
