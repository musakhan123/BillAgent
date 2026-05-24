const { extractBillData }  = require('./bill_ocr');
const { detectOverbilling } = require('./tariff_calc');
const { draftComplaint }   = require('./complaint_email');

/**
 * Runs the full analysis pipeline:
 *   1. OCR  — extract bill fields from the uploaded file
 *   2. Calc — NEPRA slab check (solar or standard)
 *   3. Returns verdict: credit / overbilled / correct
 *
 * @param {string} filePath - Absolute path to the uploaded bill image or PDF.
 * @returns {Promise<Object>}
 */
async function analyzeBill(filePath) {
  const result = {
    billData:      null,
    discrepancy:   null,
    verdict:       null,
    complaintDraft: null,
    error:         null,
  };

  try {
    result.billData = await extractBillData(filePath);

    console.log("is_protected:", result.billData.is_protected);
    console.log("units_consumed:", result.billData.units_consumed);
    console.log("fix_charges:", result.billData.fix_charges);

    result.billData.units_consumed  = Math.round(result.billData.units_consumed  || 0);
    result.billData.imported_units  = Math.round(result.billData.imported_units  || 0);
    result.billData.exported_units  = Math.round(result.billData.exported_units  || 0);

    if (result.billData.units_consumed === 0 && result.billData.imported_units > 0) {
      result.billData.units_consumed = result.billData.imported_units;
    }

    if (result.billData.is_solar && result.billData.imported_units > 0) {
      result.billData.display_units = result.billData.imported_units;
    } else {
      result.billData.display_units = result.billData.units_consumed;
    }

    // Fallback: if OCR missed is_protected, infer from usage + fixed charges
    if (!result.billData.is_protected &&
        result.billData.units_consumed <= 100 &&
        result.billData.fix_charges <= 400) {
      result.billData.is_protected = true;
    }

    result.discrepancy = detectOverbilling(result.billData);

    const d              = result.discrepancy;
    const billData       = result.billData;
    const arrear         = billData.arrear                || 0;
    const payableAmount  = billData.payable_within_due_date ?? billData.current_bill ?? 0;
    const currentBill    = billData.current_bill          || 0;

    const isCreditBill = arrear < 0 && payableAmount < 0;

    if (isCreditBill) {
      const accumulatedCredit = Math.abs(arrear);
      result.verdict = {
        status:  'credit',
        message: `This bill is NOT TO BE PAID.\nYou have an accumulated credit of PKR ${accumulatedCredit.toFixed(2)}.\nCurrent month charge: PKR ${currentBill.toFixed(2)}`,
      };
    } else if (d.isOverbilled) {
      result.verdict = {
        status:  'overbilled',
        message: `You were overcharged by PKR ${d.difference.toFixed(2)}. Correct bill: PKR ${d.correctAmount.toFixed(2)}.`,
      };
      result.complaintDraft = draftComplaint(billData, d);
    } else {
      result.verdict = {
        status:  'correct',
        message: `Bill appears correct. Charged: PKR ${currentBill.toFixed(2)}, Expected: PKR ${d.correctAmount.toFixed(2)}.`,
      };
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

module.exports = { analyzeBill };
