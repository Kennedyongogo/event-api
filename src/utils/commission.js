const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const normalizeCommissionRate = (value, fallback = 10) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(50, Math.max(0, parsed));
};

const splitAmount = (amount, commissionRate) => {
  const gross = roundMoney(amount);
  const rate = normalizeCommissionRate(commissionRate);
  const platformFee = roundMoney((gross * rate) / 100);
  const organizerShare = roundMoney(gross - platformFee);
  return {
    gross,
    commissionRate: rate,
    platformFee,
    organizerShare,
  };
};

const calculatePurchaseCommission = ({
  ticketAmount = 0,
  merchandiseLines = [],
  eventCommissionRate = 10,
}) => {
  const ticketSplit = splitAmount(ticketAmount, eventCommissionRate);

  const merchandise = merchandiseLines.map((line) => {
    const lineTotal = roundMoney(line.unit_price * line.quantity);
    const rate = normalizeCommissionRate(
      line.commission_rate,
      eventCommissionRate
    );
    const lineSplit = splitAmount(lineTotal, rate);
    return {
      ...line,
      line_total: lineSplit.gross,
      commission_rate: rate,
      platform_fee: lineSplit.platformFee,
      organizer_share: lineSplit.organizerShare,
    };
  });

  const merchandiseGross = roundMoney(
    merchandise.reduce((sum, line) => sum + line.line_total, 0)
  );
  const merchandisePlatformFee = roundMoney(
    merchandise.reduce((sum, line) => sum + line.platform_fee, 0)
  );
  const merchandiseOrganizerShare = roundMoney(
    merchandise.reduce((sum, line) => sum + line.organizer_share, 0)
  );

  const grossTotal = roundMoney(ticketSplit.gross + merchandiseGross);
  const platformFeeTotal = roundMoney(
    ticketSplit.platformFee + merchandisePlatformFee
  );
  const organizerShareTotal = roundMoney(
    ticketSplit.organizerShare + merchandiseOrganizerShare
  );

  return {
    ticketAmount: ticketSplit.gross,
    merchandiseAmount: merchandiseGross,
    totalAmount: grossTotal,
    ticketCommission: ticketSplit.platformFee,
    merchandiseCommission: merchandisePlatformFee,
    platformFeeTotal,
    organizerShareTotal,
    ticketSplit,
    merchandise,
  };
};

module.exports = {
  roundMoney,
  normalizeCommissionRate,
  splitAmount,
  calculatePurchaseCommission,
};
