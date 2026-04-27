import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  let errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
       errors.push(msg.text());
    }
  });
  page.on('pageerror', err => errors.push(err.toString()));
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  console.log("ERRORS:", errors.join('\n'));
  
  await browser.close();
  process.exit(0);
})();
