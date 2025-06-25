require("dotenv").config();
import puppeteer, { Browser, Page } from "puppeteer";
import { db } from "./db";
import { tryCatch } from "./utils";
import Groq from "groq-sdk";

const groqClient = new Groq({ apiKey: process.env.GROQ_KEY! });

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
    const productImageSet = new Set<string>();
    let productVariations = [];
    let initialProductInfo = {
      productName: "",
      price: "",
      image: "",
      brand: "",
      manufacturer: "",
      identifier: "",
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
      initialProductInfo.productName =
        initialRemoveUnnecessaryKeywords(originalName);
      initialProductInfo.brand = getGpuBrand(originalName);
      initialProductInfo.manufacturer = getManufacturer(originalName);
      initialProductInfo.identifier = getGpuIdentifier(originalName);
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

  // includes array items containing products with variation
  const productListWithVariations = await Promise.all(withName);

  // flattened items with variation
  const productList = productListWithVariations.reduce((acc, curr) => {
    return acc?.concat(Array.isArray(curr) ? curr : [curr]);
  }, []);

  console.log(productListWithVariations, "product w variation");

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

const modelMatcher = /(?<=\b(?:GTX|RTX|GT)\s*)\d{3,4}\b/i;
const familyMatcher = /\b(?:GTX|RTX|GT)\b/i;
const nvidiaPerformanceSuffixMatcher =
  /\b(?:TI(?:\s+SUPER)?|SUPER(?:\s+TI)?)\b/i;

function getGpuIdentifier(originalName: string): string {
  let gpuNameInParts: string[] = [
    getManufacturer(originalName),
    getGpuBrand(originalName),
  ];

  let familyMatch = originalName.match(familyMatcher);
  let modelMatch = originalName.match(modelMatcher);
  let performanceSuffixMatch = originalName.match(
    nvidiaPerformanceSuffixMatcher
  );

  if (familyMatch !== null) {
    gpuNameInParts.push(familyMatch[0]);
  }

  if (modelMatch !== null) {
    gpuNameInParts.push(modelMatch[0]);
  }

  if (performanceSuffixMatch !== null) {
    gpuNameInParts.push(performanceSuffixMatch[0]);
  }

  const series = getSeriesByBrand(originalName);

  if (series !== "") {
    gpuNameInParts.push(series);
  }

  return gpuNameInParts.join("-").toUpperCase();
}

const MSI_SERIES_MATCHER =
  /\b(?:suprim|vanguard|expert|gaming|slim|inspire|ventus|shadow)\b/gi;

const ASUS_SERIES_MATCHER =
  /\b(?:astral|matrix|strix|tuf|gaming|proart|prime|ko|dual|mini|turbo|phoenix)\b/gi;

const PALIT_SERIES_MATCHER =
  /\b(?:gamerock|gamingpro|jetstream|dual|infinity|stormx)\b/i;

const SAPPHIRE_SERIES_MATCHER = /\b(?:toxic|pure|nitro|pulse)/i;

const ZOTAC_SERIES_MATCHER =
  /\b(?:zone|gaming|twin|eco|solo|solid|edge|amp|trinity|extreme|airo|infinity|ultra|core|sff|spider-man)\b/gi;

const INNO3D_SERIES_MATCHER =
  /\b(?:twin|x2|compact|ichill|x3|frostbite|gaming|ultra)/gi;

const GIGABYTE_SERIES_MATCHER =
  /\b(?:d6|mini|itx|gaming|xtr|turbo|pro|master|stealth|elite|vision|xtreme|windforce|waterforce|ice|eagle|low|profile)/gi;

const ASROCK_SERIES_MATCHER =
  /\b(?:aqua|formula|phantom|gaming|steel|legend|challenger|creator|passive)/gi;

const COLORFUL_SERIES_MATCHER = /\b(?:igame|colorfire)/gi;

const GALAX_SERIES_MATCHER = /\b(?:ex|gamer|1-click)/gi;

const POWERCOLOR_SERIES_MATCHER =
  /\b(?:figher|spectral|hellhound|itx|liquid|devil|low|profile|reaper|red|devil|red|dragon)/gi;

const XFX_SERIES_MATCHER =
  /\b(?:speedster|swift|core|qick\s{0,1}\d{3}|merc\s{0,1}\d{3})/gi;

function getSeriesByBrand(originalName: string): string {
  let series = "";
  let manufacturer = getManufacturer(originalName);

  if (manufacturer.toLowerCase() === "msi") {
    const msiSeries = originalName.match(MSI_SERIES_MATCHER);
    if (msiSeries !== null && msiSeries.length >= 1) {
      series = seriesKeysHandler(msiSeries);
    }
  }

  if (manufacturer.toLowerCase() === "asus") {
    const asusSeries = originalName.match(ASUS_SERIES_MATCHER);
    if (asusSeries !== null && asusSeries.length >= 1) {
      series = seriesKeysHandler(asusSeries);
    }
  }

  if (manufacturer.toLowerCase() === "palit") {
    const palitSeries = originalName.match(PALIT_SERIES_MATCHER);
    if (palitSeries !== null && palitSeries.length >= 1) {
      series = seriesKeysHandler(palitSeries);
    }
  }

  if (manufacturer.toLowerCase() === "sapphire") {
    const sapphireSeries = originalName.match(SAPPHIRE_SERIES_MATCHER);
    if (sapphireSeries !== null && sapphireSeries.length >= 1) {
      series = seriesKeysHandler(sapphireSeries);
    }
  }

  if (manufacturer.toLowerCase() === "zotac") {
    const zotacSeries = originalName.match(ZOTAC_SERIES_MATCHER);
    if (zotacSeries !== null && zotacSeries.length >= 1) {
      series = seriesKeysHandler(zotacSeries);
    }
  }

  if (manufacturer.toLowerCase() === "inno3d") {
    const inno3DSeries = originalName.match(INNO3D_SERIES_MATCHER);
    if (inno3DSeries !== null && inno3DSeries.length >= 1) {
      series = seriesKeysHandler(inno3DSeries);
    }
  }

  if (manufacturer.toLowerCase() === "gigabyte") {
    const gigabyteSeries = originalName.match(GIGABYTE_SERIES_MATCHER);
    if (gigabyteSeries !== null && gigabyteSeries.length >= 1) {
      series = seriesKeysHandler(gigabyteSeries);
    }
  }

  if (manufacturer.toLowerCase() === "asrock") {
    const asrockSeries = originalName.match(ASROCK_SERIES_MATCHER);
    if (asrockSeries !== null && asrockSeries.length >= 1) {
      series = seriesKeysHandler(asrockSeries);
    }
  }

  if (manufacturer.toLowerCase() === "colorful") {
    const colorfulSeries = originalName.match(COLORFUL_SERIES_MATCHER);
    if (colorfulSeries !== null && colorfulSeries.length >= 1) {
      series = seriesKeysHandler(colorfulSeries);
    }
  }

  if (manufacturer.toLowerCase() === "galax") {
    const galaxSeries = originalName.match(GALAX_SERIES_MATCHER);
    if (galaxSeries !== null && galaxSeries.length >= 1) {
      series = seriesKeysHandler(galaxSeries);
    }
  }

  if (manufacturer.toLowerCase() === "powercolor") {
    const powerColorSeries = originalName.match(POWERCOLOR_SERIES_MATCHER);
    if (powerColorSeries !== null && powerColorSeries.length >= 1) {
      series = seriesKeysHandler(powerColorSeries);
    }
  }

  return series;
}

function seriesKeysHandler(series: RegExpMatchArray): string {
  const seriesSet = new Set();
  for (const key of series) {
    seriesSet.add(key.toLowerCase());
  }
  return [...seriesSet].join(" ");
}

function getGpuBrand(originalName: string): string {
  let brand: "AMD" | "NVIDIA" | "INTEL" | "" = "";
  if (
    originalName.toLowerCase().includes("rtx") ||
    originalName.toLowerCase().includes("gtx") ||
    originalName.toLowerCase().includes("gt ") ||
    originalName.toLowerCase().includes("nvidia") ||
    originalName.toLowerCase().includes("geforce")
  ) {
    brand = "NVIDIA";
  }

  if (
    originalName.toLowerCase().includes("rx") ||
    originalName.toLowerCase().includes("amd")
  ) {
    brand = "AMD";
  }

  if (
    originalName.toLowerCase().includes("arc") ||
    originalName.toLowerCase().includes("intel")
  ) {
    brand = "INTEL";
  }

  return brand;
}

function getManufacturer(originalName: string): string {
  return originalName.split(" ")[0];
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

async function benchMark() {
  const startTime = Date.now();

  await getAllData();

  const endTime = Date.now();
  const durationMilliseconds = endTime - startTime;
  const durationSeconds = (durationMilliseconds / 1000).toFixed(2);
  console.log(durationSeconds, "durationSec");
}

benchMark();
