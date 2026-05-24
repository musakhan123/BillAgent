const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage }           = require('@langchain/core/messages');
const { JsonOutputParser }       = require('@langchain/core/output_parsers');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const MIME_TYPES = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
};

const IMAGE_EXTS = new Set(Object.keys(MIME_TYPES));

const PROMPT = `You are a PESCO electricity bill reader. Extract and return ONLY this JSON with no extra text:
{
  "consumer_id": "",
  "bill_month": "",
  "units_consumed": 0,
  "current_bill": 0,
  "payable_within_due_date": 0,
  "reference_no": "",
  "meter_no": "",
  "due_date": "",
  "fix_charges": 0,
  "electricity_duty": 0,
  "fuel_price_adjustment": 0,
  "gst": 0,
  "fc_surcharge": 0,
  "qtr_tariff_adj": 0,
  "meter_rent": 0,
  "service_rent": 0,
  "income_tax": 0,
  "further_tax": 0,
  "taxes_on_fpa": 0,
  "imported_units": 0,
  "exported_units": 0,
  "is_solar": false,
  "is_protected": false,
  "net_metering_credit": 0,
  "arrear": 0
}

Rules:
- units_consumed: For STANDARD bills, use the UNITS CONSUMED field in the PESCO CHARGES section. For SOLAR/NET-METERING bills, calculate from the meter reading table: find the row labelled "I" (import) and compute PRESENT minus PREVIOUS reading (e.g. 5019 - 4344 = 675). Do NOT use the UNITS CONSUMED field in PESCO CHARGES for solar bills — it may be wrong.
- meter_no: For standard bills, use the single METER NO value. For 3-phase solar bills the meter table has multiple rows — extract the meter number ONLY from the row whose description starts with "3-P I" (the 3-phase import row). Ignore the "E" (export) row and any other rows. Do not concatenate multiple meter numbers.
- current_bill: total current charges before any arrears or adjustments.
- payable_within_due_date: final payable amount near the due date (may say "Payable within due date" or "Amount Payable").
- fix_charges: Fixed Charges line in the PESCO CHARGES table.
- electricity_duty: ED or Electricity Duty line.
- fuel_price_adjustment: FPA or Fuel Price Adjustment line.
- gst: GST or General Sales Tax line.
- fc_surcharge: FC Surcharge or Financing Cost Surcharge; use 0 if absent.
- qtr_tariff_adj: QTR Tariff Adjustment or DMC line; use 0 if absent.
- meter_rent: Meter Rent line; use 0 if absent.
- service_rent: Service Rent line; use 0 if absent.
- income_tax: Income Tax line; use 0 if absent.
- further_tax: Further Tax line; use 0 if absent.
- taxes_on_fpa: TOTAL TAXES ON FPA field; use 0 if absent.
- imported_units: For solar/net-metering bills, the units imported from the grid — same value as units_consumed for solar (from the "I" import meter row PRESENT minus PREVIOUS). Use 0 for standard bills.
- exported_units: units exported to the grid — from the "E" export meter row PRESENT minus PREVIOUS. Use 0 for standard bills.
- is_solar: true only if the bill has a net-metering or solar section with exported units > 0.
- is_protected: Look for the Bill Calculation section which shows:
    GOP Tariff x Units
    [rate] X [units]
  If the rate is 10.54 or 13.01 → is_protected = true
  If the rate is 22.44 or higher → is_protected = false
  This is the most reliable way to determine protected status. Default to false if the section is not visible.
- net_metering_credit: credit amount shown on the bill for exported units; use 0 if absent.
- arrear: arrear or previous balance amount. Use a negative number if it appears as a credit (e.g. "-171145" if the bill shows a credit balance of 171145). Use 0 if absent.
- All numeric fields must be plain numbers — no commas, no currency symbols.
- If a field is not visible, use 0 for numbers and "" for strings.`;

const model = new ChatGoogleGenerativeAI({
  model:  'gemini-2.5-flash',
  apiKey: process.env.GEMINI_API_KEY,
});

const chain = model.pipe(new JsonOutputParser());

/**
 * Converts the first page of a PDF to a PNG using pdf-poppler (bundled pdftocairo).
 * Returns the path to the generated PNG file.
 */
async function pdfToImage(pdfPath) {
  const poppler  = require('pdf-poppler');
  const outDir   = os.tmpdir();
  const outPrefix = `pesco_${Date.now()}`;

  await poppler.convert(pdfPath, {
    format:     'png',
    out_dir:    outDir,
    out_prefix: outPrefix,
    page:       1,
    scale:      2048,
  });

  // pdftocairo names the output file: {out_prefix}-1.png
  return path.join(outDir, `${outPrefix}-1.png`);
}

async function extractBillData(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  let imagePath  = filePath;
  let isTempFile = false;

  if (ext === '.pdf') {
    imagePath  = await pdfToImage(filePath);
    isTempFile = true;
  } else if (!IMAGE_EXTS.has(ext)) {
    throw new Error(`Unsupported file type: ${ext}. Allowed: jpg, jpeg, png, webp, gif, pdf.`);
  }

  const mimeType    = isTempFile ? 'image/png' : MIME_TYPES[ext];
  const imageBuffer = fs.readFileSync(imagePath);

  if (isTempFile) fs.unlinkSync(imagePath);

  console.log('Image size:', imageBuffer.length, 'bytes');

  const base64 = imageBuffer.toString('base64');

  const message = new HumanMessage({
    content: [
      { type: 'text', text: PROMPT },
      {
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64}` },
      },
    ],
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Gemini API timeout after 30s')), 30000)
  );

  console.log('Sending to Gemini...');
  const result = await Promise.race([
    chain.invoke([message]),
    timeoutPromise,
  ]);
  console.log('Gemini responded');

  return result;
}

module.exports = { extractBillData };
