// All money is in pence. The backend is the only place totals are calculated.
export function calculateTotals(items, settings) {
  const subtotalPence = items.reduce((sum, i) => sum + i.unitPricePence * i.quantity, 0);

  const threshold = settings.freeShippingThresholdPence;
  const freeShipping = threshold !== null && threshold !== undefined && subtotalPence >= threshold;
  const shippingPence = freeShipping ? 0 : settings.flatShippingPence || 0;

  const rate = settings.vatRatePercent || 0;
  const beforeVat = subtotalPence + shippingPence;

  let vatPence;
  let totalPence;
  if (settings.pricesIncludeVat) {
    // VAT is already inside the prices: show how much of the total it is.
    vatPence = Math.round((beforeVat * rate) / (100 + rate));
    totalPence = beforeVat;
  } else {
    vatPence = Math.round((beforeVat * rate) / 100);
    totalPence = beforeVat + vatPence;
  }

  return { subtotalPence, shippingPence, vatPence, totalPence };
}
