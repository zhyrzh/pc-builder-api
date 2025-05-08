require("dotenv").config();
import puppeteer, { ElementFor } from "puppeteer";

(async () => {
  const productCardSelector = ".text-center.rounded-lg.bg-white.p-2";
  const productTitleSelector = ".text-title-2.text-left";
  const productPriceSelector = "div span.text-md.text-gray-900";
  const productImageSelector = "img";
  const productBrandSelector = "div.grid.grid-cols-2 h3";
  const nextButtonSelector =
    "div.flex.justify-center nav[aria-label='Page navigation example'] li:last-child";

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto("https://www.pchubonline.com/products?category=2", {
    waitUntil: "networkidle0",
  });

  let i = 1;

  while (true) {
    const productCount = await page.$$eval(
      productCardSelector,
      (products) => products.length
    );

    if (productCount === 0) {
      break;
    }

    const producList = await page.$$eval(productCardSelector, (products) =>
      products.map((itm) => ({
        name: itm.querySelector(productTitleSelector)?.textContent,
        price: Number.parseFloat(
          itm
            .querySelector(productPriceSelector)
            ?.textContent.replace("₱ ", "")
            .replace(",", "")
        ),
        image: `https://www.pchubonline.com${itm
          .querySelector(productImageSelector)
          ?.getAttribute("src")}`,
        brand: itm
          .querySelector(productBrandSelector)
          ?.textContent.replace("● ", ""),
      }))
    );

    const nextButton = await page.$(nextButtonSelector);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      nextButton!.click(),
    ]);
    console.log(producList, i);
    i++;
  }

  await browser.close();
})();
