const fetchAPY = (req, res) => {
  try {
    return res.json({
      '7d': 1.23,
      '30d': 2.34,
      '60d': 3.56,
      '90d': 4.78,
      '365d': 5.91,
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
      return fetchAPY(req, res);
    default:
      res.setHeader('Allow', ['POST', 'OPTIONS']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
};

export default handler;
