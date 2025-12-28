import { bech32 } from "@scure/base";

const data =
	"lnbc40n1p52av53pp5jfz89k9eulhz8c2pxl0wv2yjdvwzuar4nau4u8ech8fcvwfgzrgqhp5m250m3njpr2yztxsury6l5z3ayyw5637vfayvqtdnshakf5ttywscqzzsxqyz5vqsp5lq9cjw9yy3p5q58r0y0jhy3ejm55h8s544zy2eamgk3c4wfnh9lq9qxpqysgqqa3jq22xgqps4sw3nua4k5t9yr7wfuv8vlvkcuaq376gx263avt3fhzw0ky3easgkyj89wdpw26p4yhsrhzqdwld9ncfv5rfs42e49sps8s43y";
const decoded = bech32.decode(data, 512);

console.log(decoded.words);
console.log(Buffer.from(bech32.fromWords(decoded.words)).toString("utf8"));
