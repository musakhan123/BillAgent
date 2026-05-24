const PESCO_COMPLAINTS = 'complaints@pesco.gov.pk';
const NEPRA_CC         = 'complaint@nepra.org.pk';

/**
 * Drafts a formal overbilling complaint letter.
 * Returns null if the bill is not overbilled or is a credit bill.
 *
 * @param {Object} billData    - Extracted bill fields from bill_ocr.js
 * @param {Object} discrepancy - Result from detectOverbilling in tariff_calc.js
 * @returns {Object|null}
 */
function draftComplaint(billData, discrepancy) {
  if (!discrepancy || !discrepancy.isOverbilled) return null;

  const consumerId    = billData.consumer_id    || 'N/A';
  const meterNo       = billData.meter_no       || 'N/A';
  const referenceNo   = billData.reference_no   || 'N/A';
  const billMonth     = billData.bill_month     || 'N/A';
  const dueDate       = billData.due_date       || 'N/A';
  const charged       = discrepancy.chargedAmount.toFixed(2);
  const correct       = discrepancy.correctAmount.toFixed(2);
  const difference    = discrepancy.difference.toFixed(2);

  const subject = `Overbilling Complaint — Consumer ID: ${consumerId} — ${billMonth}`;

  const today = new Date().toLocaleDateString('en-PK', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const body = `Date: ${today}

To,
The Complaints Officer
Peshawar Electric Supply Company (PESCO)
Email: ${PESCO_COMPLAINTS}

CC: National Electric Power Regulatory Authority (NEPRA)
Email: ${NEPRA_CC}

Subject: ${subject}

Dear Sir/Madam,

I am writing to formally register a complaint regarding an incorrect and inflated electricity bill issued for the billing period of ${billMonth}.

CONSUMER DETAILS
----------------
Consumer ID    : ${consumerId}
Meter Number   : ${meterNo}
Reference No.  : ${referenceNo}
Billing Period : ${billMonth}
Due Date       : ${dueDate}

BILLING DISCREPANCY
-------------------
Amount Charged (Current Bill)  : PKR ${charged}
Correct Amount (NEPRA Tariff)  : PKR ${correct}
Overcharged By                 : PKR ${difference}

I have independently verified my bill against the NEPRA-approved residential tariff schedule (progressive slab rates currently in effect). The calculation reveals that I have been overcharged by PKR ${difference} for this billing period.

REQUEST
-------
I respectfully request PESCO to:

  1. Review and correct the bill for the billing period of ${billMonth}.
  2. Issue an adjusted bill reflecting the correct amount of PKR ${correct}.
  3. Carry forward the excess amount of PKR ${difference} as a credit in my next bill, or arrange a refund.

I draw your attention to NEPRA's published tariff schedule and the consumer protection provisions under the NEPRA Act, which require that consumers be billed only at the approved tariff rates.

If this matter is not resolved within 7 working days, I reserve the right to escalate this complaint to NEPRA's Consumer Services Department.

Please acknowledge receipt of this complaint at your earliest convenience.

Yours sincerely,

Consumer ID: ${consumerId}
Meter No.  : ${meterNo}`;

  return {
    to:      PESCO_COMPLAINTS,
    cc:      NEPRA_CC,
    subject,
    body,
  };
}

module.exports = { draftComplaint };
