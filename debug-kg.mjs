import { chromium } from "playwright-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const errors = [];
page.on("pageerror", (err) => errors.push(err.message));
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

await page.goto("http://localhost:3000/auth", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.fill("#email", "teste.kg@bebigas.local");
await page.fill("#senha", "TesteDebug123!");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
console.log("URL:", page.url());

await page.goto("http://localhost:3000/vendas/nova", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

// click a kg product (Costela de Vaca Assada is unidade=kg)
await page.click('button:has-text("Costela de Vaca Assada")');
await page.waitForTimeout(300);
await page.screenshot({ path: "debug-kg-cart-added.png" });

// try setting a decimal kg amount
const kgInput = page.locator('input[type="number"]').last();
await kgInput.fill("1.5");
await kgInput.blur();
await page.waitForTimeout(400);
await page.screenshot({ path: "debug-kg-cart-decimal.png" });

// also add a unit product to confirm stepper still works there
await page.click('button:has-text("Frango Assado")');
await page.waitForTimeout(300);
await page.screenshot({ path: "debug-kg-cart-mixed.png" });

console.log("errors:", errors.join("\n") || "(none)");
await browser.close();
