/**
 * Static, explainable lists used by local heuristics. These are indicators,
 * not proof of maliciousness, and no live reputation data is implied.
 */

export interface BrandDefinition {
  brand: string;
  officialDomains: string[];
}

export const BRANDS: BrandDefinition[] = [
  { brand: "paypal", officialDomains: ["paypal.com", "paypal.me"] },
  { brand: "microsoft", officialDomains: ["microsoft.com", "live.com", "office.com", "office365.com"] },
  { brand: "apple", officialDomains: ["apple.com", "icloud.com"] },
  { brand: "google", officialDomains: ["google.com", "gmail.com"] },
  { brand: "amazon", officialDomains: ["amazon.com", "amazon.co.uk", "aws.amazon.com"] },
  { brand: "netflix", officialDomains: ["netflix.com"] },
  { brand: "facebook", officialDomains: ["facebook.com", "fb.com"] },
  { brand: "instagram", officialDomains: ["instagram.com"] },
  { brand: "whatsapp", officialDomains: ["whatsapp.com"] },
  { brand: "outlook", officialDomains: ["outlook.com", "live.com"] },
  { brand: "coinbase", officialDomains: ["coinbase.com"] },
  { brand: "binance", officialDomains: ["binance.com"] },
  { brand: "chase", officialDomains: ["chase.com"] },
  { brand: "wellsfargo", officialDomains: ["wellsfargo.com"] },
  { brand: "bankofamerica", officialDomains: ["bankofamerica.com"] },
  { brand: "dhl", officialDomains: ["dhl.com"] },
  { brand: "fedex", officialDomains: ["fedex.com"] },
  { brand: "steam", officialDomains: ["steampowered.com", "steamcommunity.com"] },
  { brand: "roblox", officialDomains: ["roblox.com"] },
  { brand: "dropbox", officialDomains: ["dropbox.com"] },
  { brand: "adobe", officialDomains: ["adobe.com"] },
  { brand: "github", officialDomains: ["github.com"] },
  { brand: "linkedin", officialDomains: ["linkedin.com"] },
  { brand: "spotify", officialDomains: ["spotify.com"] },
];

/** TLDs that are frequently abused, while also used by legitimate sites. */
export const HIGH_ABUSE_TLDS = new Set([
  "zip",
  "mov",
  "top",
  "xyz",
  "click",
  "link",
  "live",
  "fit",
  "gq",
  "tk",
  "ml",
  "ga",
  "cf",
  "work",
  "rest",
  "cam",
  "buzz",
  "monster",
  "sbs",
  "cfd",
  "icu",
  "cyou",
]);

export const SHORTENER_DOMAINS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "cutt.ly",
  "rebrand.ly",
  "shorturl.at",
  "tiny.cc",
  "rb.gy",
]);

export const EXECUTABLE_EXTENSIONS = new Set([
  "exe",
  "scr",
  "bat",
  "cmd",
  "com",
  "pif",
  "msi",
  "apk",
  "dll",
  "js",
  "vbs",
  "ps1",
  "jar",
  "hta",
  "lnk",
  "iso",
  "img",
  "docm",
  "xlsm",
  "pptm",
]);

export const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z"]);

export const CREDENTIAL_THEME_WORDS = [
  "login",
  "signin",
  "verify",
  "secure",
  "account",
  "update",
  "wallet",
  "webscr",
  "billing",
  "support",
  "auth",
  "password",
  "payment",
];

/** Common second-level public suffixes (small, explicit subset). */
export const MULTI_PART_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.in",
  "net.in",
  "org.in",
  "com.br",
  "com.mx",
  "co.jp",
  "co.nz",
  "co.za",
  "com.sg",
  "com.tr",
  "com.cn",
  "com.hk",
  "com.tw",
  "co.il",
]);

export const DISCLAIMER =
  "Local heuristic analysis. This is an indicator of potential risk, not a definitive malware verdict or a guarantee of safety.";

export const PROVIDER_UNAVAILABLE_MESSAGE =
  "Live threat intelligence is unavailable. Only local analysis is available.";
