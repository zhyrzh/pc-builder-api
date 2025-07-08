import {
  AMD_MEMORY_TYPES,
  ASROCK_SERIES_MATCHER,
  ASUS_SERIES_MATCHER,
  COLORFUL_SERIES_MATCHER,
  GPU_FAMILY_MATCHER,
  GALAX_SERIES_MATCHER,
  GIGABYTE_SERIES_MATCHER,
  INNO3D_SERIES_MATCHER,
  GPU_MODEL_MATCHER,
  MSI_SERIES_MATCHER,
  NVIDIA_MEMORY_TYPES,
  PALIT_SERIES_MATCHER,
  GPU_PERFORMANCE_SUFFIX_MATCHER,
  POWERCOLOR_SERIES_MATCHER,
  SAPPHIRE_SERIES_MATCHER,
  XFX_SERIES_MATCHER,
  ZOTAC_SERIES_MATCHER,
} from "./constants";

export function getManufacturer(originalName: string): string {
  const splitted = originalName.split(" ");

  return splitted.length >= 1 && splitted[0].match(/\d{1,2}G/i) === null
    ? splitted[0]
    : splitted[1];
}

export function getSeriesByBrand(originalName: string): string {
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

export function seriesKeysHandler(series: RegExpMatchArray): string {
  const seriesSet = new Set();
  for (const key of series) {
    seriesSet.add(key.toLowerCase());
  }
  return [...seriesSet].join("_");
}

export const normalizePrice = (price: string): number => {
  return parseInt(price.replace("₱", "").replace(",", ""));
};

export function getGpuIdentifier(originalName: string): string {
  let gpuNameInParts: string[] = [
    getManufacturer(originalName),
    getGpuBrand(originalName),
  ];

  let familyMatch = originalName.match(GPU_FAMILY_MATCHER);
  let modelMatch = originalName.match(GPU_MODEL_MATCHER);
  let performanceSuffixMatch = originalName.match(
    GPU_PERFORMANCE_SUFFIX_MATCHER
  );

  if (familyMatch !== null) {
    gpuNameInParts.push(familyMatch[0]);
  }

  if (modelMatch !== null) {
    gpuNameInParts.push(modelMatch[0]);
  }

  if (performanceSuffixMatch !== null) {
    let suffix = performanceSuffixMatch[0];
    if (performanceSuffixMatch[0].split(" ").length >= 2) {
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

export function getGpuBrand(originalName: string): string {
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

export function getGeneralModel(originalName: string): string {
  let generalModelInParts: string[] = [];

  const familyMatch = originalName.match(GPU_FAMILY_MATCHER);
  const seriesMatch = originalName.match(GALAX_SERIES_MATCHER);
  const performanceSuffixMatch = originalName.match(
    GPU_PERFORMANCE_SUFFIX_MATCHER
  );

  if (familyMatch !== null) {
    generalModelInParts.push(familyMatch[0]);
  }

  if (seriesMatch !== null) {
    generalModelInParts.push(seriesMatch[0]);
  }

  if (performanceSuffixMatch !== null) {
    generalModelInParts.push(performanceSuffixMatch[0]);
  }

  return generalModelInParts.join(" ").toUpperCase();
}

export function getMemoryType(
  originalName: string,
  brand: string,
  general_model: string
): string {
  let memoryType = "";
  const memoryTypeMatch = originalName.match(/\bGDDR\d{1,2}X?\b/i);

  if (memoryTypeMatch !== null) {
    memoryType = memoryTypeMatch[0];
  }

  if (memoryType === "") {
    if (brand.toUpperCase() === "NVIDIA" && general_model) {
      memoryType =
        NVIDIA_MEMORY_TYPES[general_model as keyof typeof NVIDIA_MEMORY_TYPES];
    }

    if (brand.toUpperCase() === "AMD") {
      memoryType =
        AMD_MEMORY_TYPES[general_model as keyof typeof AMD_MEMORY_TYPES];
    }

    if (brand.toUpperCase() === "INTEL") {
      memoryType = "GDDR6";
    }
  }

  return memoryType;
}

export function getMemorySize(originalName: string): number {
  let memorySize = "";
  // const memorySizeMatch = originalName.match(/\b\d{1,2}\s*GB?\b/i);
  const memorySizeMatch = originalName.match(/\b(\d+)\s?G[B]?\b/gi);

  if (memorySizeMatch !== null) {
    memorySize = memorySizeMatch[0].replace(/\s?G(?:B)?\b/gi, "");
  }

  return parseInt(memorySize);
}
