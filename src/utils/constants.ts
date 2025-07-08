export const MSI_SERIES_MATCHER =
  /\b(?:suprim|vanguard|expert|gaming|x|slim|inspire|ventus|shadow)\b/gi;

export const ASUS_SERIES_MATCHER =
  /\b(?:astral|matrix|strix|tuf|gaming|proart|prime|ko|dual|mini|turbo|phoenix)\b/gi;

export const PALIT_SERIES_MATCHER =
  /\b(?:gamerock|gamingpro|jetstream|dual|infinity|stormx)\b/i;

export const SAPPHIRE_SERIES_MATCHER = /\b(?:toxic|pure|nitro|pulse)/i;

export const ZOTAC_SERIES_MATCHER =
  /\b(?:zone|gaming|twin|eco|solo|solid|edge|amp|trinity|extreme|airo|infinity|ultra|core|sff|spider-man)\b/gi;

export const INNO3D_SERIES_MATCHER =
  /\b(?:twin|x2|compact|ichill|x3|frostbite|gaming|ultra)/gi;

export const GIGABYTE_SERIES_MATCHER =
  /\b(?:d6|mini|itx|gaming|xtr|turbo|pro|master|stealth|elite|vision|xtreme|windforce|waterforce|ice|eagle|low|profile)/gi;

export const ASROCK_SERIES_MATCHER =
  /\b(?:aqua|formula|phantom|gaming|steel|legend|challenger|d|pro|creator|passive)/gi;

export const COLORFUL_SERIES_MATCHER =
  /\b(?:igame|colorfire|battle|ax|duo|ultra)/gi;

export const GALAX_SERIES_MATCHER = /\b(?:ex|gamer|1-click)/gi;

export const POWERCOLOR_SERIES_MATCHER =
  /\b(?:figher|spectral|hellhound|itx|liquid|devil|low|profile|reaper|red|devil|red|dragon)/gi;

export const XFX_SERIES_MATCHER =
  /\b(?:speedster|swift|mercury|quicksilver|qick\s{0,1}\d{3}|merc\s{0,1}\d{3}|core)/gi;

export const PNY_SERIES_MATCHER = /\b(?:verto|xlr8|epic-x)/gi;

export const GPU_MODEL_MATCHER =
  /(?<=\b(?:GTX|RTX|GT|RX)\s*)\d{3,4}\b|\b[AB]\d{3}\b/gi;

export const GPU_FAMILY_MATCHER = /\b(RTX|ARC|GTX|RX)\b/i;

export const GPU_PERFORMANCE_SUFFIX_MATCHER =
  /(?=\d{4})?(?:TI(?:\s+SUPER)?|SUPER(?:\s+TI)?|XT(?:\s{0,1}X)?)|GRE\b/i;

export const NVIDIA_MEMORY_TYPES = {
  GT_1030: "GDDR5",
  GTX_1050: "GDDR5",
  GTX_1050_TI: "GDDR5",
  GTX_1060: "GDDR5",
  GTX_1060_TI: "GDDR5",
  GTX_1070: "GDDR5",
  GTX_1070_TI: "GDDR5",
  GTX_1080: "GDDR5X",
  GTX_1080_TI: "GDDR5X",
  GTX_1650: "GDDR6",
  GTX_1650_SUPER: "GDDR6",
  GTX_1660: "GDDR6",
  GTX_1660_TI: "GDDR6",
  GTX_1660_SUPER: "GDDR6",
  RTX_2060: "GDDR6",
  RTX_2060_SUPER: "GDDR6",
  RTX_2070: "GDDR6",
  RTX_2070_SUPER: "GDDR6",
  RTX_2080: "GDDR6",
  RTX_2080_SUPER: "GDDR6",
  RTX_3060: "GDDR6",
  RTX_3060_TI: "GDDR6",
  RTX_3070: "GDDR6",
  RTX_3070_TI: "GDDR6X",
  RTX_3080: "GDDR6X",
  RTX_3080_TI: "GDDR6X",
  RTX_3090: "GDDR6X",
  RTX_3090_TI: "GDDR6X",
  RTX_4060: "GDDR6",
  RTX_4060_TI: "GDDR6",
  RTX_4070: "GDDR6X",
  RTX_4070_SUPER: "GDDR6X",
  RTX_4070_TI: "GDDR6X",
  RTX_4080: "GDDR6X",
  RTX_4080_SUPER: "GDDR6X",
  RTX_4080_TI: "GDDR6X",
  RTX_4090: "GDDR6X",
  RTX_4090_TI: "GDDR6X",
  RTX_4090_TI_SUPER: "GDDR6X",
  RTX_5060: "GDDR7",
  RTX_5060_TI: "GDDR7",
  RTX_5070: "GDDR7",
  RTX_5070_TI: "GDDR7",
  RTX_5080: "GDDR7",
};

export const AMD_MEMORY_TYPES = {
  RX_550: "GDDR5",
  RX_560: "GDDR5",
  RX_570: "GDDR5",
  RX_580: "GDDR5",
  RX_590: "GDDR5",
  RX_5500: "GDDR6",
  RX_5500_XT: "GDDR6",
  RX_5600: "GDDR6",
  RX_5600_XT: "GDDR6",
  RX_5700: "GDDR6",
  RX_5700_XT: "GDDR6",
  RX_6500_XT: "GDDR6",
  RX_6600: "GDDR6",
  RX_6600_XT: "GDDR6",
  RX_6650_XT: "GDDR6",
  RX_6700: "GDDR6",
  RX_6700_XT: "GDDR6",
  RX_6750_XT: "GDDR6",
  RX_6750_GRE: "GDDR6",
  RX_6800: "GDDR6",
  RX_6800_XT: "GDDR6",
  RX_6900: "GDDR6",
  RX_6900_XT: "GDDR6",
  RX_7600: "GDDR6",
  RX_7600_XT: "GDDR6",
  RX_7700: "GDDR6",
  RX_7700_XT: "GDDR6",
  RX_7800_XT: "GDDR6",
  RX_7900_XT: "GDDR6",
  RX_7900_XTX: "GDDR6",
  RX_9060: "GDDR6",
  RX_9060_XT: "GDDR6",
  RX_9070: "GDDR6",
  RX_9070_XT: "GDDR6",
};
