require("dotenv").config();
import puppeteer, { Browser, Page } from "puppeteer";
import { db } from "./db";
import { tryCatch } from "./utils";
import Groq from "groq-sdk";
import util from "util";
import { gpusTable, soldByTable, TGpu, TSoldBy } from "#db/schema.ts";
import { eq } from "drizzle-orm";
import {
  getGeneralModel,
  getGpuBrand,
  getGpuIdentifier,
  getManufacturer,
  getMemorySize,
  getMemoryType,
  normalizePrice,
} from "#utils/helpers.ts";

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
  price: number;
};

type TExtras = {
  variation?: TVariation[]; // variation is needed to get a single item that has different price range
  additionalInfo?: string[]; // additional info is needed to get infos not found on original name
};

async function getAllData(): Promise<Array<any>> {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const mainPage = await browser.newPage();

  let allProducts: Array<Omit<TGpu, "id" | "created_at"> & TSoldBy> = [];

  mainPage.setViewport(pageDefualtViewPortSettings);

  await mainPage.goto(
    "https://bermorzone.com.ph/product-category/video-cards/page/1",
    {
      waitUntil: "load",
      timeout: 0,
    }
  );

  while (true) {
    const productsWithLink: Pick<TSoldBy, "link">[] = await mainPage.$$eval(
      "li.product.type-product",
      allProductsEvalCallback
    );

    const withOrigNameLinkPriceImageVariationAddInfo: Array<
      Promise<
        Pick<TGpu, "image"> &
          Pick<TSoldBy, "original_name" | "price" | "link"> &
          TExtras
      >
    > = productsWithLink.map(async (p) => {
      const productImageSet = new Set<string>();
      const productInfo: Pick<TGpu, "image"> &
        Pick<TSoldBy, "original_name" | "price" | "link"> &
        TExtras = {
        ...p,
        original_name: "",
        price: 0,
        image: "",
        variation: [],
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

      const { data: initialPriceInfo } = await tryCatch(
        productPage.$eval("p.price span.electro-price", (itm) =>
          itm.querySelector("ins span bdi") !== null
            ? itm.querySelector("ins span bdi")?.textContent
            : itm.querySelector("bdi")?.textContent
        )
      );

      if (initialPriceInfo !== null && initialPriceInfo !== undefined) {
        productInfo.price = normalizePrice(initialPriceInfo);
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
          itm.includes(productInfo.image!)
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

    const sanitized = withGenModlMnfctrIdntfrBrndMemSizeMemType.reduce<any>(
      (acc: Array<TGpu & Omit<TSoldBy, "identifier_id">>, curr) => {
        const { variation, additionalInfo, ...requiredDetails } = curr;
        if (variation !== undefined && variation!.length >= 1) {
          if (variation.every((v) => v.color !== undefined)) {
            for (const v of variation) {
              acc.push({
                ...requiredDetails,
                identifier: `${curr.identifier}(${v.color})`,
                price: v.price,
                vendor_name: "BTZ",
              });
            }
          }
          if (variation.every((v) => v.memory !== undefined)) {
            for (const v of variation) {
              acc.push({
                ...requiredDetails,
                identifier: `${curr.identifier}(${v.memory})`,
                price: v.price,
                memory_size:
                  v.memory !== undefined && v.memory.match(/\s?G(?:B)?\b/gi)
                    ? parseInt(v.memory.replace(/\s?G(?:B)?\b/gi, ""))
                    : parseInt(v.memory!),
                vendor_name: "BTZ",
              });
            }
          }
        } else {
          acc.push({
            ...requiredDetails,
            vendor_name: "BTZ",
          });
        }

        return acc;
      },
      []
    );

    console.log(
      util.inspect(sanitized, { depth: null }),
      "withGenModMnfctrIdntfrBrndMemSizeMemType"
    );

    allProducts = [...allProducts, ...sanitized];

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
  return allProducts;
}

async function handleMultiProductVariation(
  productPage: Page,
  variations: string[],
  originalName: string
): Promise<{ variant: string; price: number }[]> {
  let productVariations: { variant: string; price: number }[] = [];

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
        await selectHandler(productPage, v, variationValues[i]);

        if (!v.toLowerCase().includes("brand")) {
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

          if (price !== null && price !== undefined) {
            prevPriceRead = evaluatorCondition!;
            productVariations.push({
              variant: variationValues[i],
              price: normalizePrice(price),
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
): Promise<{ [property]: string; price: number }[]> {
  let productVariations: { [property]: string; price: number }[] = [];

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
        price: normalizePrice(nonVariationPrice!),
      });
    } else if (variationValues.length === 2) {
      for (let i = 0; i <= variationValues.length - 1; i++) {
        if (nonVariationPrice !== null) {
          const priceRange = nonVariationPrice.split(" – ");
          if (priceRange.length === 2) {
            productVariations.push({
              [property]: variationValues[i],
              price: normalizePrice(priceRange[i]),
            });
          } else {
            const priceWithDiscount = nonVariationPrice.split(" ");
            productVariations.push({
              [property]: variationValues[i],
              price: normalizePrice(priceWithDiscount[0]),
            });
          }
        }
      }
    } else {
      let prevPriceRead = "";
      for (let i = 0; i <= variationValues.length - 1; i++) {
        await selectHandler(productPage, variation, variationValues[i]);

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
            price: normalizePrice(price!),
          });
        }
      }
    }
  }

  return productVariations;
}

async function selectHandler(
  page: Page,
  variation: string,
  selectValue: string
) {
  Promise.all([
    await tryCatch(
      page.waitForSelector(`table.variations select[id='${variation}`),
      "3?"
    ),
    await tryCatch(
      page.click(`table.variations select[id='${variation}']`),
      "1?"
    ),
  ]);

  await tryCatch(
    page.select(`table.variations select[id='${variation}']`, selectValue),
    "2?"
  );

  await tryCatch(
    page.waitForSelector(
      "div.woocommerce-variation-price span.electro-price ins span bdi"
    ),
    "4?"
  );
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
  // const data = await db
  //   .select()
  //   .from(gpusTable)
  //   .leftJoin(soldByTable, eq(soldByTable.identifier_id, gpusTable.identifier));

  // console.log(util.inspect(data, { depth: null }), "data");

  const endTime = Date.now();
  const durationMilliseconds = endTime - startTime;
  const durationSeconds = (durationMilliseconds / 1000).toFixed(2);
  console.log(durationSeconds, "durationSec");
}

benchMark();
