const puppeteer = require('puppeteer-core');
const fs        = require('fs');
const path      = require('path');

const PESCO_URL = 'https://bill.pitc.com.pk/pescobill/general';

async function scrapeBillData(consumerId) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  page.on('response', async (response) => {
    const url = response.url();
    console.log('NETWORK:', response.status(), url);
    try {
      const text = await response.text();
      if (text.includes('UNITS') || text.includes('units') || text.includes('bill_month')) {
        console.log('FOUND DATA:', text.substring(0, 500));
      }
    } catch(e) {}
  });

  try {
    await page.goto(`${PESCO_URL}?appno=${encodeURIComponent(consumerId)}`, {
      waitUntil: 'networkidle2',
      timeout:   30000,
    });

    await page.waitForSelector('td', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 8000));

    const html = await page.content();
    fs.writeFileSync(path.join(__dirname, '..', 'debug.html'), html, 'utf8');

    const data = await page.evaluate(() => {
      const result = {
        consumer_id:             '',
        bill_month:              '',
        units_consumed:          0,
        current_bill:            0,
        payable_within_due_date: 0,
        reference_no:            '',
        meter_no:                '',
        due_date:                '',
        fix_charges:             0,
        electricity_duty:        0,
        fuel_price_adjustment:   0,
      };

      document.querySelectorAll('td').forEach((td, i) => {
        const text    = td.innerText.trim().toLowerCase();
        const nextTd  = td.nextElementSibling;
        const nextVal = nextTd ? nextTd.innerText.trim() : '';

        console.log(`TD ${i}: "${td.innerText.trim().substring(0, 50)}"`);

        if (text === 'units consumed')          result.units_consumed          = parseFloat(nextVal) || 0;
        if (text === 'current bill')            result.current_bill            = parseFloat(nextVal) || 0;
        if (text === 'payable within due date') result.payable_within_due_date = parseFloat(nextVal) || 0;
        if (text === 'reference no')            result.reference_no            = nextVal;
        if (text === 'customer id')             result.consumer_id             = nextVal;
        if (text === 'meter no')                result.meter_no                = nextVal;
        if (text === 'bill month')              result.bill_month              = nextVal;
        if (text === 'due date')                result.due_date                = nextVal;
        if (text === 'fix charges')             result.fix_charges             = parseFloat(nextVal) || 0;
        if (text === 'electricity duty')        result.electricity_duty        = parseFloat(nextVal) || 0;
        if (text === 'fuel price adjustment')   result.fuel_price_adjustment   = parseFloat(nextVal) || 0;
      });

      return result;
    });

    return data;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeBillData };
