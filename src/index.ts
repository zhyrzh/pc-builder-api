import puppeteer, { ElementFor } from "puppeteer";

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto("https://www.pchubonline.com/products?category=2", {
    waitUntil: "networkidle0",
  });

  let i = 1;

  while (true) {
    const productCount = await page.$$eval(
      ".text-center.rounded-lg.bg-white.p-2",
      (products) => products.length
    );

    if (productCount === 0) {
      break;
    }

    const producList = await page.$$eval(
      ".text-center.rounded-lg.bg-white.p-2",
      (products) =>
        products.map((itm) => ({
          title: itm.querySelector(".text-title-2.text-left")?.textContent,
          price: Number.parseFloat(
            itm
              .querySelector("div span.text-md.text-gray-900")
              ?.textContent.replace("₱ ", "")
              .replace(",", "")
          ),
          image: `https://www.pchubonline.com${itm
            .querySelector("img")
            ?.getAttribute("src")}`,
          brand: itm
            .querySelector("div.grid.grid-cols-2 h3")
            ?.textContent.replace("● ", ""),
        }))
    );

    const nextButton = await page.$(
      "div.flex.justify-center nav[aria-label='Page navigation example'] li:last-child"
    );

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      nextButton!.click(),
    ]);
    console.log(producList, i);
    i++;
  }

  await browser.close();
})();
