import { bech32 } from "@scure/base";

// const target = "https://bitlifi.com/.well-known/lnurlp/pepakriz";
// const target = "https://pay.blink.sv/.well-known/lnurlp/pepakriz";
const target = "https://bitlifi.com/.well-known/lnurlp/barupaula";
const bytes = Buffer.from(target, "utf8");

// Convert 8-bit bytes to 5-bit words
const words = bech32.toWords(bytes);

// Encode as Bech32 with HRP 'lnurl'
const lnurl = bech32.encode("lnurl", words, 145);

console.log(lnurl.toUpperCase());
