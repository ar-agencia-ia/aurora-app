const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const url = process.env.FORMS_URL || (html.match(/var FORMS_URL = "([^"]*)";/) || [])[1];

test('forms exige login Google', async ({ page }) => {
  // Gate de go-live: sem URL o teste falha em vez de pular (skipped sairia com exit 0 e pareceria prova).
  expect(url, 'Forms ainda não criado: sem FORMS_URL no ambiente e Portão fechado').toBeTruthy();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/accounts\.google\.com/);
});
