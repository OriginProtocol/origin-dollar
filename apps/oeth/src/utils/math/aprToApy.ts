const aprToApy = (apr, aprDays) => {
  const periodsPerYear = 365.25 / aprDays;
  return Math.pow(1 + apr / 100 / periodsPerYear, periodsPerYear) - 1;
};

export default aprToApy;
