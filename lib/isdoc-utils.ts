import { formatPostalCode } from "@/lib/format-utils";
import { parseCzechBankAccountFromIban } from "@/lib/iban-utils";
import { CountryCode } from "@/lib/types";
import { type Invoice, InvoicePaymentMethod } from "@/storages/invoice-storage";

const mapCountryCodeToName: Record<CountryCode, string> = {
	[CountryCode.CZ]: "Česká republika",
};

const mapPaymentMethodToNumber: Record<InvoicePaymentMethod, number> = {
	[InvoicePaymentMethod.BankTransfer]: 42,
	[InvoicePaymentMethod.Cash]: 10,
	[InvoicePaymentMethod.PaymentCard]: 48,
};

export const createIsdocXml = (invoice: Invoice) => {
	const createParty = (
		billingInfo:
			| Invoice["supplier"]["billingInfo"]
			| Invoice["customer"]["billingInfo"],
	) => `<Party>
      <PartyIdentification>
        <ID></ID>
      </PartyIdentification>
      <PartyName>
        <Name>${billingInfo.name}</Name>
      </PartyName>
      <PostalAddress>
        <StreetName>${billingInfo.address.street}</StreetName>
        <BuildingNumber>${billingInfo.address.descriptiveNumber}</BuildingNumber>
        <CityName>${billingInfo.address.city}</CityName>
        <PostalZone>${formatPostalCode(billingInfo.address.postalCode)}</PostalZone>
        <Country>
          <IdentificationCode>${billingInfo.countrySpecific.countryCode}</IdentificationCode>
          <Name>${mapCountryCodeToName[billingInfo.countrySpecific.countryCode]}</Name>
        </Country>
      </PostalAddress>
      ${
				billingInfo.countrySpecific.vatNumber
					? `<PartyTaxScheme>
        <CompanyID>${billingInfo.countrySpecific.vatNumber}</CompanyID>
        <TaxScheme>VAT</TaxScheme>
      </PartyTaxScheme>`
					: ""
			}
    </Party>`;

	const createLine = (
		line: Invoice["items"][number],
		id: number,
	) => `<InvoiceLine>
      <ID>${id}</ID>
      <InvoicedQuantity unitCode="${line.unitOfMeasure}">${line.quantity.toString()}</InvoicedQuantity>
      <LineExtensionAmount>${line.price.toString()}</LineExtensionAmount>
      <LineExtensionAmountTaxInclusive>${line.price.toString()}</LineExtensionAmountTaxInclusive>
      <LineExtensionTaxAmount>0.0</LineExtensionTaxAmount>
      <UnitPrice>${line.price.toString()}</UnitPrice>
      <UnitPriceTaxInclusive>${line.price.toString()}</UnitPriceTaxInclusive>
      <ClassifiedTaxCategory>
        <Percent>0</Percent>
        <VATCalculationMethod>0</VATCalculationMethod>
        <VATApplicable>false</VATApplicable>
      </ClassifiedTaxCategory>
      <Note>${line.unitOfMeasure}</Note>
      <Item>
        <Description>${line.label}</Description>
      </Item>
    </InvoiceLine>`;

	const supplierParty = createParty(invoice.supplier.billingInfo);
	const customerParty = createParty(invoice.customer.billingInfo);

	const totalAmount = invoice.items.reduce(
		(acc, value) => acc + value.price * value.quantity,
		0,
	);

	const czechBankAccount =
		invoice.payment.method === "bankTransfer"
			? parseCzechBankAccountFromIban(invoice.payment.iban)
			: null;

	return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.2">
  <DocumentType>1</DocumentType>
  <ID>${invoice.invoiceNumber}</ID>
  <UUID>${invoice.invoiceId}</UUID>
  <IssuingSystem>Finito</IssuingSystem>
  <IssueDate>${invoice.issueDate}</IssueDate>
  <VATApplicable>${invoice.supplier.billingInfo.countrySpecific.vatPayer}</VATApplicable>
  <ElectronicPossibilityAgreementReference/>
  <Note></Note>
  <LocalCurrencyCode>${invoice.currency}</LocalCurrencyCode>
  <CurrRate>1.0</CurrRate>
  <RefCurrRate>1</RefCurrRate>
  <AccountingSupplierParty>
    ${supplierParty}
  </AccountingSupplierParty>
  <SellerSupplierParty>
    ${supplierParty}
  </SellerSupplierParty>
  <AccountingCustomerParty>
    ${customerParty}
  </AccountingCustomerParty>
  <BuyerCustomerParty>
    ${customerParty}
  </BuyerCustomerParty>
  <InvoiceLines>
  	${invoice.items.map((item, index) => createLine(item, index + 1)).join("\n")}
  </InvoiceLines>
  <TaxTotal>
    <TaxSubTotal>
      <TaxableAmount>${totalAmount.toString()}</TaxableAmount>
      <TaxAmount>0.0</TaxAmount>
      <TaxInclusiveAmount>${totalAmount.toString()}</TaxInclusiveAmount>
      <AlreadyClaimedTaxableAmount>0</AlreadyClaimedTaxableAmount>
      <AlreadyClaimedTaxAmount>0</AlreadyClaimedTaxAmount>
      <AlreadyClaimedTaxInclusiveAmount>0</AlreadyClaimedTaxInclusiveAmount>
      <DifferenceTaxableAmount>${totalAmount.toString()}</DifferenceTaxableAmount>
      <DifferenceTaxAmount>0.0</DifferenceTaxAmount>
      <DifferenceTaxInclusiveAmount>${totalAmount.toString()}</DifferenceTaxInclusiveAmount>
      <TaxCategory>
        <Percent>0</Percent>
      </TaxCategory>
    </TaxSubTotal>
    <TaxAmount>0.0</TaxAmount>
  </TaxTotal>
  <LegalMonetaryTotal>
    <TaxExclusiveAmount>${totalAmount.toString()}</TaxExclusiveAmount>
    <TaxInclusiveAmount>${totalAmount.toString()}</TaxInclusiveAmount>
    <AlreadyClaimedTaxExclusiveAmount>0</AlreadyClaimedTaxExclusiveAmount>
    <AlreadyClaimedTaxInclusiveAmount>0</AlreadyClaimedTaxInclusiveAmount>
    <DifferenceTaxExclusiveAmount>${totalAmount.toString()}</DifferenceTaxExclusiveAmount>
    <DifferenceTaxInclusiveAmount>${totalAmount.toString()}</DifferenceTaxInclusiveAmount>
    <PayableRoundingAmount>0.0</PayableRoundingAmount>
    <PaidDepositsAmount>0</PaidDepositsAmount>
    <PayableAmount>${totalAmount.toString()}</PayableAmount>
  </LegalMonetaryTotal>
  <PaymentMeans>
    <Payment>
      <PaidAmount>${totalAmount.toString()}</PaidAmount>
      <PaymentMeansCode>${mapPaymentMethodToNumber[invoice.payment.method]}</PaymentMeansCode>
      <Details>
        <PaymentDueDate>${invoice.dueDate}</PaymentDueDate>
        <ID>${invoice.invoiceNumber}</ID>
        ${czechBankAccount !== null ? `<BankCode>${czechBankAccount.split("/")[1]}</BankCode>` : ""}
        ${invoice.payment.method === "bankTransfer" ? `<IBAN>${invoice.payment.iban}</IBAN>` : ""}
        <VariableSymbol>${invoice.invoiceNumber}</VariableSymbol>
      </Details>
    </Payment>
  </PaymentMeans>
</Invoice>
`;
};
