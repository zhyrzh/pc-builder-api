require("dotenv").config();
import puppeteer, { Browser, Page } from "puppeteer";
import { db } from "./db";
import { tryCatch } from "./utils";
import Groq from "groq-sdk";
import util from "util";
import { TGpu } from "#db/schema.js";

const groqClient = new Groq({ apiKey: process.env.GROQ_KEY! });

const pageDefualtViewPortSettings = {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  isMobile: false,
  isLandscape: true,
};

type TVariation = {
  memory?: string;
  variant?: string;
  color?: string;
  price: string;
};

type TExtras = {
  variation?: TVariation[]; // variation is needed to get a single item that has different price range
  additionalInfo?: string[]; // additional info is needed to get infos not found on original name
};

async function getAllData() {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const mainPage = await browser.newPage();

  const allProducts: Omit<TGpu, "created_at" | "id">[] = [];

  mainPage.setViewport(pageDefualtViewPortSettings);

  await mainPage.goto(
    "https://bermorzone.com.ph/product-category/video-cards/page/1",
    {
      waitUntil: "load",
      timeout: 0,
    }
  );

  while (true) {
    // const productsWithLink: Pick<TGpu, "link">[] = await mainPage.$$eval(
    //   "li.product.type-product",
    //   allProductsEvalCallback
    // );
    const productsWithLink = [
      {
        link: "https://bermorzone.com.ph/shop/video-cards/amd-video-cards/sapphire-pulse-amd-radeon-rx-9060-xt-8gb-16gb-gddr6-graphics-card/",
      },
    ];

    const withOrigNameLinkPriceImageVariationAddInfo: Array<
      Promise<
        Pick<TGpu, "original_name" | "price" | "image" | "link"> & {
          variation?: TVariation[];
          additionalInfo?: string[];
        }
      >
    > = productsWithLink.map(async (p) => {
      const productImageSet = new Set<string>();
      const productInfo: Pick<
        TGpu,
        "original_name" | "price" | "image" | "link"
      > &
        TExtras = {
        ...p,
        original_name: "",
        price: "",
        image: "",
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
        productInfo.original_name = originalName;

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

      const { data: variations, error: _variationsError } = await tryCatch(
        productPage.$$eval("table.variations tr", (itm) =>
          itm.map((i) => i.querySelector("th.label label")?.getAttribute("for"))
        ),
        "variations"
      );

      const MEMORY_VARIATION_LABEL = ["capacity", "memory", "version"];
      const VARIATION_VARIATION_LABEL = ["availability", "model"];

      if (
        variations !== null &&
        variations !== undefined &&
        variations.every((m) => m !== null) &&
        variations.every((m) => m !== undefined) &&
        originalName !== null
      ) {
        const variation = variations[0];
        if (variations.length === 1) {
          let variationProp: "memory" | "color" | "variant" | undefined;
          if (
            MEMORY_VARIATION_LABEL.some(
              (m) =>
                m.toLowerCase() === variation ||
                m.toLowerCase().includes("memory")
            )
          ) {
            variationProp = "memory";
          }

          if (variation.toLowerCase() === "color") {
            variationProp = "color";
          }

          if (
            variation.includes("varia") ||
            VARIATION_VARIATION_LABEL.some((i) => variation === i)
          ) {
            variationProp = "variant";
          }

          if (variationProp !== undefined) {
            productInfo.variation = await handleProductVariation(
              productPage,
              variation,
              originalName,
              variationProp
            );
          }
        } else {
          productInfo.variation = await handleMultiProductVariation(
            productPage,
            variations,
            originalName
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

    // items include original_name, price, image, link, variation?, additionalInfo?
    const withOrigNameLinkPriceImageVariationAddInfoResolved =
      await Promise.all(withOrigNameLinkPriceImageVariationAddInfo);

    // items incldue properties from prev handling + identifier, general_model, brand, manufacturer  variation?, additionalInfo?
    const withGenModlMnfctrIdntfrBrndMemSizeMemType =
      withOrigNameLinkPriceImageVariationAddInfoResolved.map((p) => ({
        ...p,
        identifier: getGpuIdentifier(p.original_name),
        brand: getGpuBrand(p.original_name),
        general_model: getGeneralModel(p.original_name),
        manufacturer: getManufacturer(p.original_name),
        memory_size: getMemorySize(p.original_name),
        memory_type: getMemoryType(p.original_name),
      }));

    const withUniqueVariation =
      withGenModlMnfctrIdntfrBrndMemSizeMemType.filter(
        (itm) =>
          itm.variation !== undefined &&
          itm.variation.every(
            (i) =>
              i.variant !== undefined && !i.variant.toLowerCase().includes("oc")
          )
      );
    // .map((i) => ({
    //   link: i.link,
    //   original_name: i.original_name,
    //   variation: i.variation,
    // }));

    console.log(
      util.inspect(withGenModlMnfctrIdntfrBrndMemSizeMemType, { depth: null }),
      "withGenModMnfctrIdntfrBrndMemSizeMemType"
    );

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

function getGeneralModel(originalName: string): string {
  let generalModelInParts: string[] = [];

  const familyMatch = originalName.match(familyMatcher);
  const seriesMatch = originalName.match(modelMatcher);
  const performanceSuffixMatch = originalName.match(performanceSuffixMatcher);

  if (familyMatch !== null) {
    generalModelInParts.push(familyMatch[0]);
  }

  if (seriesMatch !== null) {
    generalModelInParts.push(seriesMatch[0]);
  }

  if (performanceSuffixMatch !== null) {
    generalModelInParts.push(performanceSuffixMatch[0]);
  }

  return generalModelInParts.join(" ");
}

function getMemoryType(originalName: string): string {
  let memoryType = "";
  const memoryTypeMatch = originalName.match(/\bGDDR\d{1,2}X?\b/i);

  if (memoryTypeMatch !== null) {
    memoryType = memoryTypeMatch[0];
  }

  return memoryType;
}

function getMemorySize(originalName: string): number {
  let memorySize = "";
  // const memorySizeMatch = originalName.match(/\b\d{1,2}\s*GB?\b/i);
  const memorySizeMatch = originalName.match(/\b(\d+)\s?G[B]?\b/gi);

  if (memorySizeMatch !== null) {
    memorySize = memorySizeMatch[0];
  }

  return parseInt(memorySize);
}

async function handleMultiProductVariation(
  productPage: Page,
  variations: string[],
  originalName: string
): Promise<{ variant: string; price: string }[]> {
  let productVariations: { variant: string; price: string }[] = [];

  for (const v of variations) {
    const { data: variationValues } = await tryCatch(
      productPage.$$eval(
        `table.variations td.value select[id='${v}'] option`,
        (el) =>
          el.map((el) => el.getAttribute("value")).filter((itm) => itm !== "")
      ),
      "from variationValues"
    );

    if (variationValues !== null && variationValues.every((i) => i !== null)) {
      let prevPriceRead = "";
      for (let i = 0; i <= variationValues.length - 1; i++) {
        Promise.all([
          await tryCatch(
            productPage.waitForSelector(`table.variations select[id='${v}`),
            "3?"
          ),
          await tryCatch(
            productPage.click(`table.variations select[id='${v}']`),
            "1?"
          ),
        ]);

        await tryCatch(
          productPage.select(
            `table.variations select[id='${v}']`,
            variationValues[i]
          ),
          "2?"
        );

        if (!v.toLowerCase().includes("brand")) {
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

          if (price !== null || price !== undefined) {
            prevPriceRead = evaluatorCondition!;
            productVariations.push({
              variant: variationValues[i],
              price: price!,
            });
          }
        }
      }
    }
  }

  return productVariations;
}

async function handleProductVariation(
  productPage: Page,
  variation: string,
  originalName: string,
  property: "memory" | "color" | "variant"
): Promise<{ [property]: string; price: string }[]> {
  let productVariations: { [property]: string; price: string }[] = [];

  // productName = productName.replace(/\d+GB\s*\|\s*\d+GB/g, "");

  const { data: variationValues } = await tryCatch(
    productPage.$$eval(
      `table.variations td.value select[id='${variation}'] option`,
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

  if (variationValues !== null && variationValues.every((v) => v !== null)) {
    if (variationValues.length === 1) {
      productVariations.push({
        [property]: variationValues[0],
        price: nonVariationPrice!,
      });
    } else if (variationValues.length === 2) {
      for (let i = 0; i <= variationValues.length - 1; i++) {
        if (nonVariationPrice !== null) {
          const priceRange = nonVariationPrice.split(" – ");
          if (priceRange.length === 2) {
            productVariations.push({
              [property]: variationValues[i],
              price: priceRange[i],
            });
          } else {
            const priceWithDiscount = nonVariationPrice.split(" ");
            productVariations.push({
              [property]: variationValues[i],
              price: priceWithDiscount[0],
            });
          }
        }
      }
    } else {
      let prevPriceRead = "";
      for (let i = 0; i <= variationValues.length - 1; i++) {
        Promise.all([
          await tryCatch(
            productPage.waitForSelector(
              `table.variations select[id='${variation}`
            ),
            "3?"
          ),
          await tryCatch(
            productPage.click(`table.variations select[id='${variation}']`),
            "1?"
          ),
        ]);

        await tryCatch(
          productPage.select(
            `table.variations select[id='${variation}']`,
            variationValues[i]
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

        if (price !== null || price !== undefined) {
          prevPriceRead = evaluatorCondition!;
          productVariations.push({
            [property]: variationValues[i],
            price: price!,
          });
        }
      }
    }
  }

  return productVariations;
}

const modelMatcher =
  // /(?<=\b(?:GTX|RTX|GT|RX)\s*)\d{3,4}\b|\b(?:ARC\s*)?(?:A|B)\d{3}\b/gi;
  // /(?<=\b(?:GTX|RTX|GT|RX)\s*)\d{3,4}\b|\b[AB]\d{3}\b/gi;
  /\b(?=GTX|RTX|GT|RX)?(\d{3,4})(?=XT|TI|SUPER|OC)?|(?=ARC)?(?:A|B)\d{3}\b/gi;
const familyMatcher = /\b(?=GTX|RTX|GT|RX)?(\d{3,4})(?=XT|TI|SUPER|OC)?/gi;
const performanceSuffixMatcher =
  /(?=\d{4})?(?:TI(?:\s+SUPER)?|SUPER(?:\s+TI)?|XT(?:\s{0,1}X)?)\b/i;

function getGpuIdentifier(originalName: string): string {
  let gpuNameInParts: string[] = [
    getManufacturer(originalName),
    getGpuBrand(originalName),
  ];

  let familyMatch = originalName.match(familyMatcher);
  let modelMatch = originalName.match(modelMatcher);
  let performanceSuffixMatch = originalName.match(performanceSuffixMatcher);

  if (familyMatch !== null) {
    gpuNameInParts.push(familyMatch[0]);
  }

  if (modelMatch !== null) {
    gpuNameInParts.push(modelMatch[0]);
  }

  if (performanceSuffixMatch !== null) {
    let suffix = performanceSuffixMatch[0];
    if (performanceSuffixMatch.length >= 2) {
      suffix = performanceSuffixMatch.join("_");
    }
    gpuNameInParts.push(suffix);
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
  const splitted = originalName.split(" ");

  return splitted.length >= 1 && splitted[0].match(/\d{1,2}G/i) === null
    ? splitted[0]
    : splitted[1];
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
