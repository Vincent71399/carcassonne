import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (event: unknown) => {
        const error = event as Error;
        console.error('PAGE ERROR:', error.message);
    });
    page.on('requestfailed', request => console.error('REQUEST FAILED:', request.url(), request.failure()?.errorText));

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

    await browser.close();
})();
// This script is used for verifying browser-side logs and errors.

