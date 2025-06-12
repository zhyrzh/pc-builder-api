require("dotenv").config();
import puppeteer, { Page } from "puppeteer";
import Groq from "groq-sdk";

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto("https://www.pchubonline.com/products?category=2", {
    waitUntil: "networkidle0",
  });

  const allGpus = await getAllGPUS(page);

  if (allGpus !== undefined) {
    console.log(allGpus.length, "allgpus.lnght");
    const gpuNames = allGpus.map((itm) => itm?.name);

    const partitionedGpuNames = [];
    for (let i = 0; i < gpuNames.length; i += 40) {
      partitionedGpuNames.push(gpuNames.slice(i, i + 20));
    }

    console.log(partitionedGpuNames, "partitioned");

    const gpusWithAdditionalDetails = await getProductDetails(
      partitionedGpuNames[0]
    );

    const promptResult: { gpuDetails: Array<any> } = JSON.parse(
      gpusWithAdditionalDetails.choices[0].message.content!
    );

    console.log(promptResult, "promptResult.gpus.length");
  }

  await browser.close();
})();

async function getAllGPUS(page: Page): Promise<Array<any> | undefined> {
  try {
    const productCardSelector = ".text-center.rounded-lg.bg-white.p-2";
    const nextButtonSelector =
      "div.flex.justify-center nav[aria-label='Page navigation example'] li:last-child";
    let i = 1;
    let allGPUs: Array<any> = [];

    while (true) {
      const productCount = await page.$$eval(
        productCardSelector,
        (products) => products.length
      );

      if (productCount === 0) {
        break;
      }

      let producList = await page.$$eval(productCardSelector, (products) =>
        products.map((itm) => {
          const productTitleSelector = ".text-title-2.text-left";
          const productPriceSelector = "div span.text-md.text-gray-900";
          const productImageSelector = "img";
          const productBrandSelector = "div.grid.grid-cols-2 h3";

          const getAttributeValue = (
            selector: string,
            attribute: string
          ): string => itm?.querySelector(selector)?.getAttribute(attribute)!;

          const getTextContentValue = (selector: string) =>
            itm.querySelector(selector)?.textContent!;

          return {
            imageId: getAttributeValue("a", "id"),
            name: getTextContentValue(productTitleSelector),
            price: Number.parseFloat(
              getTextContentValue(productPriceSelector)
                ?.replace("₱ ", "")
                .replace(",", "")!
            ),
            image: `https://www.pchubonline.com${getAttributeValue(
              productImageSelector,
              "src"
            )}`,
            brand: itm
              .querySelector(productBrandSelector!)
              ?.textContent?.replace("● ", ""),
          } as any;
        })
      );

      for (let gpu of producList) {
        await page.click(`a#${gpu.imageId}`);

        const gpuLink = await page.$eval("div#view_product_link a", (el) => {
          return el !== undefined
            ? `https://www.pchubonline.com${el?.getAttribute("href")}`
            : undefined;
        });

        await page.click(
          "div.flex.items-start.justify-between.p-4.border-b.rounded-t button"
        );

        gpu.link = gpuLink;
      }

      const nextButton = await page.$(nextButtonSelector!);

      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle0" }),
        nextButton!.click(),
      ]);

      allGPUs = [...allGPUs, ...producList];
      i++;
    }

    return allGPUs;
  } catch (error) {
    if (error instanceof Error) {
      console.log(error.message);
    }
  }
}

const groq = new Groq({ apiKey: process.env.GROQ_KEY! });

async function getProductDetails(gpuNames: Array<string>) {
  return groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `I have this list of GPU names: ${gpuNames.join(
          " **** "
        )} they are separated with this separator ' *** '. I want you to find each details on that list in this form:
          {
            "gpuModel": string,
            "brand": string,
            "manufacturer": string,
            "productName": string,
            "partNumber": string,
            "gpuArchitecture": string,
            "cudaCoreCount":number,
            "memoryType": string,
            "memoryCapacity":number,
            "memoryBusWidth":number,
            "memoryBandwidth":number,
            "baseClock":number,
            "boostClock":number,
            "memoryClock":number,
            "directXSupport":number,
            "openGLSupport":float,
            "vulkanSupport":float,
            "displayPorts":number,
            "hdmiPorts":number,
            "hdmiVersion":float,
            "displayPortVersion":string,
            "powerConsumption":number,
            "recommendedPowerSupply":number,
            "coolingSystem": string,
            "cardLength":number,
            "cardHeight":number,
            "cardThickness":number,
            "supportedTechnologies": Array of string listing all gpu supported technlogies,
            "uniqueFeatures":Array of string for all gpu unique features
        }. Response should be in JSON with 'gpus' property in the form of array
        `,
      },
    ],
    model: "llama-3.1-8b-instant",
    response_format: {
      type: "json_object",
    },
  });
}
