import puppeteer, { Browser, Page } from "puppeteer";
import { db } from "./db";
import { tryCatch } from "./utils";

async function initializeScrapingTools(): Promise<Browser> {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();

  return browser;
}

async function getAllData() {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const mainPage = await browser.newPage();

  mainPage.setViewport({
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    isMobile: false,
    isLandscape: true,
  });

  await mainPage.goto(
    "https://bermorzone.com.ph/product-category/video-cards/",
    {
      waitUntil: "networkidle2",
      timeout: 0,
    }
  );

  const productsWithLink = await mainPage.$$eval(
    "li.product.type-product",
    allProductsEvalCallback
  );

  const withName = productsWithLink.map(async (p, index) => {
    let productCode = "";
    const productImageSet = new Set<string>();
    let productVariations = [];
    let initialProductInfo = {
      productName: "",
      price: "",
      image: "",
      brand: "",
    };

    const productPage = await browser.newPage();

    productPage.setViewport({
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      isMobile: false,
      isLandscape: true,
    });

    productPage.on("request", (request) => {
      if (request.resourceType() === "image") {
        productImageSet.add(request.url());
      }
    });

    await productPage.goto(p.link, {
      waitUntil: "networkidle0",
      timeout: 0,
    });

    const { data: originalName, error: _productNameError } = await tryCatch(
      productPage.$eval(
        "h1.product_title.entry-title",
        (itm) => itm.textContent
      )
    );

    if (originalName !== null) {
      const hasProductCode = originalName.match(
        /\b[A-Z]{2,}(?:-[A-Z0-9]{2,}){1,}\b/g
      );
      if (hasProductCode !== null && hasProductCode?.length! >= 1) {
        // console.log(hasProductCode, productNameDirty, "HAS MATCH");
        productCode = hasProductCode[0];
      }
      initialProductInfo.productName =
        initialRemoveUnnecessaryKeywords(originalName);
      initialProductInfo.brand = originalName.split(" ")[0];
    }

    await productPage.waitForSelector(
      "div.woocommerce-product-gallery.woocommerce-product-gallery--with-images div.flex-viewport div[data-thumb] a img[width='600']"
    );

    const { data: productImage } = await tryCatch(
      productPage.$eval(
        "div.woocommerce-product-gallery.woocommerce-product-gallery--with-images div.flex-viewport div[data-thumb] a img[width='600']",
        (itm) => itm.src
      )
    );

    if (productImage !== null && productImage !== undefined) {
      initialProductInfo.image =
        productImage.split("/")[productImage.split("/").length - 1];
    }

    const { data: initialPriceInfoWithDiscount } = await tryCatch(
      productPage.$eval("p.price span.electro-price ins span bdi", (itm) =>
        itm.textContent?.toLowerCase()
      )
    );

    const { data: initialPriceInfoNoDiscount } = await tryCatch(
      productPage.$eval("p.price span.electro-price bdi", (itm) =>
        itm.textContent?.toLowerCase()
      )
    );

    if (
      initialPriceInfoWithDiscount !== null &&
      initialPriceInfoWithDiscount !== undefined
    ) {
      initialProductInfo.price = initialPriceInfoWithDiscount;
    }

    if (
      initialPriceInfoNoDiscount !== null &&
      initialPriceInfoNoDiscount !== undefined
    ) {
      initialProductInfo.price = initialPriceInfoNoDiscount;
    }

    const { data: variations, error: _variationsError } = await tryCatch(
      productPage.$eval("table.variations th.label", (itm) =>
        itm.textContent?.toLowerCase()
      )
    );

    if (variations !== null) {
      if (
        variations === "capacity" ||
        variations === "memory" ||
        variations === "version"
      ) {
        productVariations = await handleMemoryVariation(
          productPage,
          variations,
          originalName!,
          initialProductInfo
        );
        console.log(productVariations, "product variations");
      }
    }

    if (productImageSet.size >= 1) {
      const allImages = [...productImageSet].filter((itm) =>
        itm.includes(initialProductInfo.image)
      );
      initialProductInfo.image = allImages[0];
    }

    await productPage.close();

    const returnedObj = {
      ...p,
      ...initialProductInfo,
      originalName,
      productName: finalRemovalUnnecessaryKeywords(
        initialProductInfo.productName
      ),
    };

    if (productVariations.length >= 2) {
      productVariations = productVariations.map((itm) => ({
        ...itm,
        image: initialProductInfo.image,
      }));
    }

    return productVariations.length >= 2 ? productVariations : returnedObj;
  });

  const allRes = await Promise.all(withName);
  console.log(allRes, "outside");
  await mainPage.screenshot({
    path: "mainpage-all-items.png",
    fullPage: true,
  });
}

async function handleMemoryVariation(
  productPage: Page,
  variations: string,
  originalName: string,
  productInfo: {
    productName: string;
    image: string;
    price: string;
    brand: string;
  }
): Promise<Array<any>> {
  let productName = productInfo.productName;
  let productVariations = [];

  productName = productName.replace(/\d+GB\s*\|\s*\d+GB/g, "");

  console.log(productName, "product name");

  const { data: variationValuesFromSelect } = await tryCatch(
    productPage.$$eval(
      `table.variations td.value select[id='${variations}'] option`,
      (el) =>
        el
          .map((el) => el.textContent)
          .filter((itm) => itm !== "Choose an option")
    ),
    "from variationValues"
  );

  if (
    variationValuesFromSelect !== null &&
    variationValuesFromSelect.every((vartn) => vartn !== null)
  ) {
    let prevPriceRead = "";
    for (let i = 0; i <= variationValuesFromSelect.length - 1; i++) {
      Promise.all([
        await tryCatch(
          productPage.waitForSelector(
            `table.variations select[id='${variations}`
          ),
          "3?"
        ),
        await tryCatch(
          productPage.click(`table.variations select[id='${variations}']`),
          "1?"
        ),
      ]);

      await tryCatch(
        productPage.select(
          `table.variations select[id='${variations}']`,
          variationValuesFromSelect[i]
        ),
        "2?"
      );

      await tryCatch(
        productPage.waitForSelector(
          "div.woocommerce-variation-price span.electro-price ins span bdi"
        ),
        "4?"
      );

      if (prevPriceRead !== "") {
        await productPage.waitForFunction(
          (sel, prev) => {
            const el = document.querySelector(sel);

            return el && el.textContent!.trim() !== prev;
          },
          { polling: "mutation", timeout: 6000 }, // optional options
          "div.woocommerce-variation-price span.electro-price ins span bdi",
          prevPriceRead
        );
      }

      const { data: price } = await tryCatch(
        productPage.$eval(
          "div.woocommerce-variation-price span.electro-price ins span bdi",
          (price) => price?.textContent
        ),
        `?5 ${originalName}`
      );

      if (price !== null) {
        prevPriceRead = price;
      }

      productVariations.push({
        ...productInfo,
        originalName,
        productName: `${finalRemovalUnnecessaryKeywords(productName)} ${
          variationValuesFromSelect[i]
        }`,
        price,
      });
    }
  }
  return productVariations;
}

function unifyVariationToName(variation: string, str: string): any {
  return "";
}

function initialRemoveUnnecessaryKeywords(str: string): string {
  return str
    .replace("Graphics Card", "")
    .replace("Video Card", "")
    .replace("GeForce", "")
    .replace(/GDDR\d+X?/i, "");
}

function finalRemovalUnnecessaryKeywords(str: string): string {
  return str
    .replace(/\s{2,}/, " ")
    .replace("|", "")
    .replace(/\d+\s*-?\s*bit/i, "")
    .replace(/\s{2,}/, " ")
    .trim();
}

function allProductsEvalCallback(products: HTMLElement[]) {
  return products.map((product) => {
    const linkSelector =
      "div.product-loop-header.product-item__header a.woocommerce-LoopProduct-link.woocommerce-loop-product__link";
    return {
      link: product.querySelector(linkSelector)?.getAttribute("href"),
    } as any;
  });
}

function createDelay(duration: number) {
  return new Promise((res) => {
    setTimeout(() => {
      res(true);
    }, duration);
  });
}

(async function () {
  const startTime = Date.now();

  await getAllData();

  const endTime = Date.now();
  const durationMilliseconds = endTime - startTime;
  const durationSeconds = (durationMilliseconds / 1000).toFixed(2);
  console.log(durationSeconds, "durationSec");
})();
