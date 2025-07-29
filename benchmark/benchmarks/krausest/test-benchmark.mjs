import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ 
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

try {
  const page = await browser.newPage();
  
  let hasError = false;
  page.on('pageerror', error => {
    console.error('Page error:', error.message);
    hasError = true;
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Console error:', msg.text());
      hasError = true;
    } else if (msg.text().includes('ms')) {
      console.log('Benchmark timing:', msg.text());
    }
  });
  
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
  
  // Wait a bit for any errors to show up
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (hasError === false) {
    console.log('✓ Benchmark loaded successfully without errors\!');
  }
  
} finally {
  await browser.close();
}
