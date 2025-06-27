require("dotenv").config();
import puppeteer, { Browser, Page } from "puppeteer";
import { db } from "./db";
import { tryCatch } from "./utils";
import Groq from "groq-sdk";
import util from "util";

const groqClient = new Groq({ apiKey: process.env.GROQ_KEY! });

const pageDefualtViewPortSettings = {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  isMobile: false,
  isLandscape: true,
};

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

  const allProducts: {
    originalName: string;
    price: string;
    image: string;
    link: string;
    identifier: string;
    brand: string;
    manufacturer: string;
    memory?: string;
    color?: string;
    variant?: string;
  }[] = [];

  mainPage.setViewport(pageDefualtViewPortSettings);

  await mainPage.goto(
    "https://bermorzone.com.ph/product-category/video-cards/page/1",
    {
      waitUntil: "load",
      timeout: 0,
    }
  );

  let lastPage = 1;

  while (true) {
    const productsWithLink = await mainPage.$$eval(
      "li.product.type-product",
      allProductsEvalCallback
    );

    const withLinkPriceImageVariation = productsWithLink.map(async (p) => {
      const productImageSet = new Set<string>();
      let productInfo: {
        originalName: string;
        price: string;
        image: string;
        link: string;
        variation?: {
          memory?: string;
          color?: string;
          variant?: string;
          price: string;
        }[];
        additionalInfo?: (string | null | undefined)[];
      } = {
        ...p,
        originalName: "",
        price: "",
        image: "",
        additionalInfo: [],
      };

      const productPage = await browser.newPage();

      productPage.setViewport(pageDefualtViewPortSettings);

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
        // initialProductInfo.brand = getGpuBrand(originalName);
        // initialProductInfo.manufacturer = getManufacturer(originalName);
        // initialProductInfo.identifier = getGpuIdentifier(originalName);
        productInfo.originalName = originalName;

        await tryCatch(
          productPage.waitForSelector(
            "div.woocommerce-product-gallery.woocommerce-product-gallery--with-images div[data-thumb] a img.wp-post-image"
          ),
          "prime" + originalName
        );
      }

      const { data: productImage } = await tryCatch(
        productPage.$eval(
          "div.woocommerce-product-gallery.woocommerce-product-gallery--with-images div[data-thumb] a img.wp-post-image",
          (itm) => itm.src
        )
      );

      if (productImage !== null && productImage !== undefined) {
        productInfo.image =
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
        productInfo.price = initialPriceInfoWithDiscount;
      }

      if (
        initialPriceInfoNoDiscount !== null &&
        initialPriceInfoNoDiscount !== undefined
      ) {
        productInfo.price = initialPriceInfoNoDiscount;
      }

      const { data: variation, error: _variationsError } = await tryCatch(
        productPage.$eval("table.variations th.label", (itm) =>
          itm.textContent?.toLowerCase()
        )
      );

      const MEMORY_VARIATION_LABEL = ["capacity", "memory", "version"];

      if (
        variation !== null &&
        originalName !== null &&
        variation !== undefined
      ) {
        let variationProp: "memory" | "color" | "variant" | undefined;
        if (MEMORY_VARIATION_LABEL.some((m) => m.toLowerCase() === variation)) {
          variationProp = "memory";
        }

        if (variation.toLowerCase() === "color") {
          variationProp = "color";
        }

        if (variation.toLowerCase() === "variant") {
          variationProp = "variant";
        }

        if (variationProp !== undefined) {
          productInfo.variation = await handleMemoryVariation(
            productPage,
            variation,
            originalName,
            variationProp
          );
        }
      }

      const { data: additionalInfo, error: _additionalInfoError } =
        await tryCatch(
          productPage.$$eval(
            "div.woocommerce-tabs.wc-tabs-wrapper div.woocommerce-Tabs-panel.woocommerce-Tabs-panel--description.panel.entry-content.wc-tab div.electro-description.clearfix table tbody tr",
            (trs) =>
              trs.map((itm) => {
                const prop = itm.querySelectorAll("td")[0].textContent;
                if (prop !== null && prop !== undefined) {
                  if (
                    prop.toLowerCase().includes("memory") ||
                    prop.toLowerCase().includes("power")
                  )
                    return `${itm.querySelectorAll("td")[0].textContent}=${
                      itm.querySelectorAll("td")[1].textContent
                    }: `;
                }
              })
          )
        );

      if (additionalInfo !== null) {
        productInfo.additionalInfo = additionalInfo.reduce<string[]>(
          (acc, curr) => {
            if (curr !== null && curr !== undefined) {
              acc.push(curr);
            }
            return acc;
          },
          []
        );
      }

      if (productImageSet.size >= 1) {
        const allImages = [...productImageSet].filter((itm) =>
          itm.includes(productInfo.image)
        );
        productInfo.image = allImages[0];
      }

      await productPage.close();

      return productInfo;
    });

    // includes array items containing products with variation
    const withLinkPriceImageVariationResolved = await Promise.all(
      withLinkPriceImageVariation
    );

    const withAllDetails = withLinkPriceImageVariationResolved.reduce<
      {
        originalName: string;
        price: string;
        image: string;
        link: string;
        identifier: string;
        brand: string;
        manufacturer: string;
        memory?: string;
        color?: string;
        variant?: string;
      }[]
    >((acc, curr) => {
      const identifier = getGpuIdentifier(curr.originalName);
      const manufacturer = getManufacturer(curr.originalName);
      const brand = getGpuBrand(curr.originalName);
      const info = {
        ...curr,
        identifier,
        manufacturer,
        brand,
      };

      delete info.variation;

      if (curr.variation !== undefined) {
        if (curr.variation.every((v) => v.memory !== undefined)) {
          for (let variation of curr.variation) {
            acc.push({
              ...info,
              memory: variation.memory,
              price: variation.price,
            });
          }
        }
        if (curr.variation.every((v) => v.color !== undefined)) {
          for (let variation of curr.variation) {
            acc.push({
              ...info,
              color: variation.color,
              price: variation.price,
            });
          }
        }
        if (curr.variation.every((v) => v.variant !== undefined)) {
          for (let variation of curr.variation) {
            acc.push({
              ...info,
              variant: variation.variant,
              price: variation.price,
            });
          }
        }
      } else {
        acc.push({
          ...curr,
          identifier,
          manufacturer,
          brand,
        });
      }

      return acc;
    }, []);
    lastPage += 1;

    console.log(withAllDetails, lastPage, "withAllDetails");
    allProducts.concat(withAllDetails);

    const { data: nextButton } = await tryCatch(
      mainPage.$("nav.electro-advanced-pagination a.next.page-numbers"),
      "nextb"
    );
    if (nextButton !== null) {
      await Promise.all([
        mainPage.waitForNavigation({
          waitUntil: "networkidle0",
          timeout: 0,
        }),
        nextButton.click(),
      ]);
    } else {
      break;
    }
  }

  console.log(
    util.inspect(allProducts, { depth: null }),
    "product w variation"
  );
}

async function handleMemoryVariation(
  productPage: Page,
  variations: string,
  originalName: string,
  property: "memory" | "color" | "variant"
): Promise<{ [property]: string; price: string }[]> {
  let productVariations: { [property]: string; price: string }[] = [];

  // productName = productName.replace(/\d+GB\s*\|\s*\d+GB/g, "");

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

  const { data: nonVariationPrice } = await tryCatch(
    productPage.$eval("p.price span.electro-price", (p) => p.textContent)
  );

  if (
    variationValuesFromSelect !== null &&
    variationValuesFromSelect.every((v) => v !== null)
  ) {
    if (variationValuesFromSelect.length === 1) {
      productVariations.push({
        [property]: variationValuesFromSelect[0],
        price: nonVariationPrice!,
      });
    } else if (variationValuesFromSelect.length === 2) {
      for (let i = 0; i <= variationValuesFromSelect.length - 1; i++) {
        if (nonVariationPrice !== null) {
          const priceRange = nonVariationPrice.split(" – ");
          if (priceRange.length === 2) {
            productVariations.push({
              [property]: variationValuesFromSelect[i],
              price: priceRange[i],
            });
          } else {
            const priceWithDiscount = nonVariationPrice.split(" ");
            productVariations.push({
              [property]: variationValuesFromSelect[i],
              price: priceWithDiscount[0],
            });
          }
        }
      }
    } else {
      let prevPriceRead = "";
      console.log(variationValuesFromSelect, "variation from selec");
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

        // const { data: withDiscountPrice } = await tryCatch(
        //   productPage.$("div.woocommerce-variation-price span.electro-price")
        // );

        await tryCatch(
          productPage.waitForSelector(
            "div.woocommerce-variation-price span.electro-price ins span bdi"
          ),
          "4?" + originalName
        );

        if (prevPriceRead !== "") {
          await productPage.waitForFunction(
            (sel1, prev) => {
              const el1 = document.querySelector(sel1);

              return el1 && el1.textContent!.trim() !== prev;
            },
            { polling: "mutation", timeout: 6000 }, // optional options
            "div.woocommerce-variation-price span.electro-price",
            prevPriceRead
          );
        }

        const { data: price } = await tryCatch(
          productPage.$eval(
            "div.woocommerce-variation-price span.electro-price",
            (p) =>
              p?.querySelector("ins span bdi")
                ? p.querySelector("ins span bdi")?.textContent
                : p.textContent
          ),
          `?5 ${originalName}`
        );

        const { data: evaluatorCondition } = await tryCatch(
          productPage.$eval(
            "div.woocommerce-variation-price span.electro-price",
            (p) => p.textContent
          ),
          `?5 ${originalName}`
        );
        console.log(prevPriceRead, "outside");
        if (price !== null || price !== undefined) {
          prevPriceRead = evaluatorCondition!;
          productVariations.push({
            [property]: variationValuesFromSelect[i],
            price: price!,
          });
        }

        console.log(productVariations, "product variations");
      }
    }
  }

  return productVariations;
}

const modelMatcher =
  // /(?<=\b(?:GTX|RTX|GT|RX)\s*)\d{3,4}\b|\b(?:ARC\s*)?(?:A|B)\d{3}\b/gi;
  /(?<=\b(?:GTX|RTX|GT|RX)\s*)\d{3,4}\b|\b[AB]\d{3}\b/gi;
const familyMatcher = /\b(?:GTX|RTX|GT|RX|ARC)\b/i;
const nvidiaPerformanceSuffixMatcher =
  /\b(?:TI(?:\s+SUPER)?|SUPER(?:\s+TI)?|XT(?:\s{0,1}X)?)\b/i;

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
  /\b(?:speedster|swift|mercury|quicksilver|qick\s{0,1}\d{3}|merc\s{0,1}\d{3}|core)/gi;

const PNY_SERIES_MATCHER = /\b(?:verto|xlr8|epic-x)/gi;

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

  if (manufacturer.toLowerCase() === "xfx") {
    const xfxSeries = originalName.match(XFX_SERIES_MATCHER);
    if (xfxSeries !== null && xfxSeries.length >= 1) {
      series = seriesKeysHandler(xfxSeries);
    }
  }

  return series;
}

function seriesKeysHandler(series: RegExpMatchArray): string {
  const seriesSet = new Set();
  for (const key of series) {
    seriesSet.add(key.toLowerCase());
  }
  return [...seriesSet].join("_");
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
    } as { link: string };
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

// else {
//           const { data: priceNoDiscount } = await tryCatch(
//             productPage.$eval(
//               "div.woocommerce-variation-price span.electro-price ins span bdi",
//               (price) => price?.textContent
//             ),
//             "from test " + originalName
//           );

//           if (priceNoDiscount) {
//             prevPriceRead = priceNoDiscount;
//             productVariations.push({
//               [property]: variationValuesFromSelect[i],
//               price: priceNoDiscount,
//             });
//           }
//         }

// if (
//     variationValuesFromSelect !== null &&
//     variationValuesFromSelect.every((vartn) => vartn !== null)
//   ) {
//     let prevPriceRead = "";
//     for (let i = 0; i <= variationValuesFromSelect.length - 1; i++) {
//       const { data: priceRange } = await tryCatch(
//         productPage.$eval("p.price span.electro-price", (p) => p.textContent),
//         "has pricerange"
//       );

//       if (
//         priceRange !== null &&
//         priceRange !== undefined &&
//         !priceRange.includes("–")
//       ) {
//         const { data: initialPriceInfoWithDiscount } = await tryCatch(
//           productPage.$eval("p.price span.electro-price ins span bdi", (itm) =>
//             itm.textContent?.toLowerCase()
//           )
//         );
//         if (
//           initialPriceInfoWithDiscount !== null &&
//           initialPriceInfoWithDiscount !== undefined
//         ) {
//           productVariations.push({
//             [property]: variationValuesFromSelect[i],
//             price: initialPriceInfoWithDiscount,
//           });
//         }
//       } else {
//         Promise.all([
//           await tryCatch(
//             productPage.waitForSelector(
//               `table.variations select[id='${variations}`
//             ),
//             "3?"
//           ),
//           await tryCatch(
//             productPage.click(`table.variations select[id='${variations}']`),
//             "1?"
//           ),
//         ]);

//         await tryCatch(
//           productPage.select(
//             `table.variations select[id='${variations}']`,
//             variationValuesFromSelect[i]
//           ),
//           "2?"
//         );

//         const { data: withDiscountPrice } = await tryCatch(
//           productPage.$(
//             "div.woocommerce-variation-price span.electro-price ins span bdi"
//           )
//         );

//         await tryCatch(
//           productPage.waitForSelector(
//             "div.woocommerce-variation-price span.electro-price ins span bdi"
//           ),
//           "4?" + originalName
//         );

//         if (prevPriceRead !== "") {
//           await productPage.waitForFunction(
//             (sel, prev) => {
//               const el = document.querySelector(sel);

//               return el && el.textContent!.trim() !== prev;
//             },
//             { polling: "mutation", timeout: 6000 }, // optional options
//             "div.woocommerce-variation-price span.electro-price ins span bdi",
//             prevPriceRead
//           );
//         }

//         const { data: price } = await tryCatch(
//           productPage.$eval(
//             "div.woocommerce-variation-price span.electro-price ins span bdi",
//             (price) => price?.textContent
//           ),
//           `?5 ${originalName}`
//         );

//         if (price !== null) {
//           prevPriceRead = price;
//           productVariations.push({
//             [property]: variationValuesFromSelect[i],
//             price,
//           });
//         }
//       }
//     }
//   }
