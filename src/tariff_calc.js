const TV_FEE        = 35;
const BUYBACK_RATE  = 7.74; // PKR per exported unit (NEPRA net-metering rate)

const SLABS_NON_PROTECTED = [
  { upTo: 100,      rate: 22.44 },
  { upTo: 200,      rate: 28.91 },
  { upTo: 300,      rate: 33.10 },
  { upTo: Infinity, rate: 41.78 },
];

// Protected consumers (≤200 units/month). If units exceed 200 the whole bill
// is re-rated at non-protected slabs (NEPRA 2025-26 classification rule).
const SLABS_PROTECTED = [
  { upTo: 100, rate: 10.54 },
  { upTo: 200, rate: 13.01 },
];

/**
 * Calculates the correct bill using NEPRA progressive slab rates plus all surcharges.
 *
 * @param {number} units
 * @param {number} fixCharges
 * @param {number} electricityDuty
 * @param {number} fuelPriceAdjustment
 * @param {number} fcSurcharge
 * @param {number} qtrTariffAdj
 * @param {number} meterRent
 * @returns {Object} Full breakdown + total
 */
function calculateCorrectBill(
  units,
  is_protected        = false,
  fixCharges          = 0,
  gst                 = 0,
  electricityDuty     = 0,
  fuelPriceAdjustment = 0,
  fcSurcharge         = 0,
  qtrTariffAdj        = 0,
  meterRent           = 0,
  serviceRent         = 0,
  incomeTax           = 0,
  furtherTax          = 0,
  taxesOnFpa          = 0
) {
  console.log("calculateCorrectBill called with is_protected:", is_protected);
  console.log("Using tariff type:", is_protected ? "protected" : "non-protected");

  // ── Slab energy charges ───────────────────────────────────────────────────
  const slabs       = (is_protected && units <= 200) ? SLABS_PROTECTED : SLABS_NON_PROTECTED;
  const slabBreakdown = [];
  let remaining     = units;
  let prevUpTo      = 0;
  let energyCharges = 0;

  for (const slab of slabs) {
    if (remaining <= 0) break;

    const slabCapacity = slab.upTo === Infinity ? remaining : slab.upTo - prevUpTo;
    const unitsInSlab  = Math.min(remaining, slabCapacity);
    const cost         = parseFloat((unitsInSlab * slab.rate).toFixed(2));

    slabBreakdown.push({
      range: slab.upTo === Infinity ? `${prevUpTo + 1}+` : `${prevUpTo + 1}–${slab.upTo}`,
      units: unitsInSlab,
      rate:  slab.rate,
      cost,
    });

    energyCharges += cost;
    remaining     -= unitsInSlab;
    prevUpTo       = slab.upTo === Infinity ? prevUpTo : slab.upTo;

    console.log("Slab rate being used:", slab.rate);
    console.log("Energy charges calculated:", energyCharges);
    console.log("Fixed charge used:", fixCharges);
  }

  energyCharges = parseFloat(energyCharges.toFixed(2));

  // ── Total ─────────────────────────────────────────────────────────────────
  const total = parseFloat((
    energyCharges +
    fixCharges +
    gst +
    electricityDuty +
    fuelPriceAdjustment +
    fcSurcharge +
    qtrTariffAdj +
    meterRent +
    serviceRent +
    incomeTax +
    furtherTax +
    taxesOnFpa +
    TV_FEE
  ).toFixed(2));

  console.log("Energy:", energyCharges);
  console.log("Fixed:", fixCharges);
  console.log("GST:", gst);
  console.log("Electricity Duty:", electricityDuty);
  console.log("FPA:", fuelPriceAdjustment);
  console.log("FC Surcharge:", fcSurcharge);
  console.log("QTR Adj:", qtrTariffAdj);
  console.log("Taxes on FPA:", taxesOnFpa);
  console.log("Meter Rent:", meterRent);
  console.log("TV Fee:", TV_FEE);
  console.log("TOTAL:", total);

  return {
    slabBreakdown,
    energyCharges,
    fixCharges,
    gst,
    electricityDuty,
    fuelPriceAdjustment,
    fcSurcharge,
    qtrTariffAdj,
    meterRent,
    serviceRent,
    incomeTax,
    furtherTax,
    taxesOnFpa,
    tvFee: TV_FEE,
    total,
  };
}

/**
 * Calculates net-metering bill for solar consumers.
 * Exported units earn a buyback credit at NEPRA rate (7.74/unit).
 * The credit is subtracted from the gross bill; if negative, it carries forward.
 *
 * @param {number} importedUnits - Units consumed from the grid
 * @param {number} exportedUnits - Units sent back to the grid
 * @param {number} fixCharges
 * @param {number} electricityDuty
 * @param {number} fuelPriceAdjustment
 * @param {number} fcSurcharge
 * @param {number} qtrTariffAdj
 * @param {number} meterRent
 * @returns {Object}
 */
function calculateSolarBill(
  importedUnits,
  exportedUnits,
  is_protected        = false,
  fixCharges          = 0,
  gst                 = 0,
  electricityDuty     = 0,
  fuelPriceAdjustment = 0,
  fcSurcharge         = 0,
  qtrTariffAdj        = 0,
  meterRent           = 0,
  serviceRent         = 0,
  incomeTax           = 0,
  furtherTax          = 0,
  taxesOnFpa          = 0
) {
  const grossBill    = calculateCorrectBill(importedUnits, is_protected, fixCharges, gst, electricityDuty, fuelPriceAdjustment, fcSurcharge, qtrTariffAdj, meterRent, serviceRent, incomeTax, furtherTax, taxesOnFpa);
  const exportCredit = parseFloat((exportedUnits * BUYBACK_RATE).toFixed(2));
  const netPayable   = parseFloat((grossBill.total - exportCredit).toFixed(2));
  const isCredit     = netPayable < 0;

  return {
    grossBill,
    exportedUnits,
    exportCredit,
    netPayable:   isCredit ? 0 : netPayable,
    isCredit,
    creditAmount: isCredit ? parseFloat(Math.abs(netPayable).toFixed(2)) : 0,
  };
}

/**
 * Compares the billed payable amount against the NEPRA-correct amount.
 * Routes to solar or standard calculation based on billData.is_solar.
 *
 * @param {Object} billData - Output from extractBillData
 * @returns {Object}
 */
function detectOverbilling(billData) {
  const isProtected         = billData.is_protected           || false;
  const correctFixedCharge  = billData.is_three_phase ? 150 : 75;
  const gst                 = billData.gst                   || 0;
  const electricityDuty     = billData.electricity_duty      || 0;
  const fuelPriceAdjustment = billData.fuel_price_adjustment || 0;
  const fcSurcharge         = billData.fc_surcharge          || 0;
  const qtrTariffAdj        = billData.qtr_tariff_adj        || 0;
  const meterRent           = billData.meter_rent            || 0;
  const serviceRent         = billData.service_rent          || 0;
  const incomeTax           = billData.income_tax            || 0;
  const furtherTax          = billData.further_tax           || 0;
  const taxesOnFpa          = billData.taxes_on_fpa          || 0;
  // Always use current_bill for overbilling comparison — payable_within_due_date
  // includes accumulated arrear credits and would give a false result.
  const chargedAmount = billData.current_bill || 0;

  if (billData.is_solar) {
    const importedUnits = billData.imported_units || 0;
    const exportedUnits = billData.exported_units || 0;

    const solar         = calculateSolarBill(importedUnits, exportedUnits, isProtected, correctFixedCharge, gst, electricityDuty, fuelPriceAdjustment, fcSurcharge, qtrTariffAdj, meterRent, serviceRent, incomeTax, furtherTax, taxesOnFpa);
    const correctAmount = solar.grossBill.total; // compare gross charges, not net-of-export
    const difference    = parseFloat((chargedAmount - correctAmount).toFixed(2));
    const isOverbilled  = difference > correctAmount * 0.05; // >5% threshold

    return {
      isSolar: true,
      isOverbilled,
      chargedAmount,
      correctAmount,
      difference,
      solar,
    };
  }

  const units         = billData.units_consumed || 0;
  const breakdown     = calculateCorrectBill(units, isProtected, correctFixedCharge, gst, electricityDuty, fuelPriceAdjustment, fcSurcharge, qtrTariffAdj, meterRent, serviceRent, incomeTax, furtherTax, taxesOnFpa);
  const correctAmount = breakdown.total;
  const difference    = parseFloat((chargedAmount - correctAmount).toFixed(2));
  const isOverbilled  = difference > correctAmount * 0.05; // >5% threshold

  return {
    isSolar: false,
    isOverbilled,
    chargedAmount,
    correctAmount,
    difference,
    breakdown,
  };
}

module.exports = { calculateCorrectBill, calculateSolarBill, detectOverbilling };
