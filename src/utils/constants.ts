export const MSI_SERIES_MATCHER =
  /\b(?:suprim|vanguard|expert|gaming|slim|inspire|ventus|shadow)\b/gi;

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
  /\b(?:aqua|formula|phantom|gaming|steel|legend|challenger|creator|passive)/gi;

export const COLORFUL_SERIES_MATCHER =
  /\b(?:igame|colorfire|battle|ax|duo|ultra)/gi;

export const GALAX_SERIES_MATCHER = /\b(?:ex|gamer|1-click)/gi;

export const POWERCOLOR_SERIES_MATCHER =
  /\b(?:figher|spectral|hellhound|itx|liquid|devil|low|profile|reaper|red|devil|red|dragon)/gi;

export const XFX_SERIES_MATCHER =
  /\b(?:speedster|swift|mercury|quicksilver|qick\s{0,1}\d{3}|merc\s{0,1}\d{3}|core)/gi;

export const PNY_SERIES_MATCHER = /\b(?:verto|xlr8|epic-x)/gi;

export const modelMatcher =
  /(?<=\b(?:GTX|RTX|GT|RX)\s*)\d{3,4}\b|\b[AB]\d{3}\b/gi;

export const familyMatcher = /\b(RTX|ARC|GTX|RX)\b/i;

export const performanceSuffixMatcher =
  /(?=\d{4})?(?:TI(?:\s+SUPER)?|SUPER(?:\s+TI)?|XT(?:\s{0,1}X)?)|GRE\b/i;
