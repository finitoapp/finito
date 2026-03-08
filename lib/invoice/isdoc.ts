import { type Invoice, InvoicePaymentMethod } from "@/lib/evolu/model/invoice";
import { CountryCode } from "@/lib/shared/types";
import { formatPostalCode } from "@/lib/shared/utils/format";
import { parseCzechBankAccountFromIban } from "@/lib/shared/utils/iban";

const mapCountryCodeToName: Record<CountryCode, string> = {
	[CountryCode.CZ]: "Česká republika",
};

const mapPaymentMethodToNumber: Record<InvoicePaymentMethod, number> = {
	[InvoicePaymentMethod.BankTransfer]: 42,
	[InvoicePaymentMethod.Cash]: 10,
	[InvoicePaymentMethod.PaymentCard]: 48,
};

export const createIsdocXml = (invoice: Invoice) => {
	const createParty = (props: {
		billingInfo:
			| Invoice["invoiceSupplierBillingInfo"]
			| Invoice["invoiceCustomerBillingInfo"];
		address:
			| Invoice["invoiceSupplierBillingInfoAddress"]
			| Invoice["invoiceCustomerBillingInfoAddress"];
		countrySpecific:
			| Invoice["invoiceSupplierBillingInfoCz"]
			| Invoice["invoiceCustomerBillingInfoCz"];
	}) => `<Party>
      <PartyIdentification>
        <ID></ID>
      </PartyIdentification>
      <PartyName>
        <Name>${props.billingInfo.name}</Name>
      </PartyName>
      <PostalAddress>
        <StreetName>${props.address.street}</StreetName>
        <BuildingNumber>${props.address.descriptiveNumber}</BuildingNumber>
        <CityName>${props.address.city}</CityName>
        <PostalZone>${props.address.postalCode ? formatPostalCode(props.address.postalCode) : ""}</PostalZone>
        <Country>
          <IdentificationCode>${props.billingInfo.countryCode}</IdentificationCode>
          <Name>${mapCountryCodeToName[props.billingInfo.countryCode]}</Name>
        </Country>
      </PostalAddress>
      ${
				props.countrySpecific.vatNumber
					? `<PartyTaxScheme>
        <CompanyID>${props.countrySpecific.vatNumber}</CompanyID>
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
      <InvoicedQuantity unitCode="${line.item.unitOfMeasure}">${line.quantity.toString()}</InvoicedQuantity>
      <LineExtensionAmount>${line.totalAmount.toString()}</LineExtensionAmount>
      <LineExtensionAmountTaxInclusive>${line.item.price.toString()}</LineExtensionAmountTaxInclusive>
      <LineExtensionTaxAmount>0.0</LineExtensionTaxAmount>
      <UnitPrice>${line.item.price.toString()}</UnitPrice>
      <UnitPriceTaxInclusive>${line.item.price.toString()}</UnitPriceTaxInclusive>
      <ClassifiedTaxCategory>
        <Percent>0</Percent>
        <VATCalculationMethod>0</VATCalculationMethod>
        <VATApplicable>false</VATApplicable>
      </ClassifiedTaxCategory>
      <Note>${line.item.unitOfMeasure}</Note>
      <Item>
        <Description>${line.item.label}</Description>
      </Item>
    </InvoiceLine>`;

	const supplierParty = createParty({
		billingInfo: invoice.invoiceSupplierBillingInfo,
		address: invoice.invoiceSupplierBillingInfoAddress,
		countrySpecific: invoice.invoiceSupplierBillingInfoCz,
	});
	const customerParty = createParty({
		billingInfo: invoice.invoiceCustomerBillingInfo,
		address: invoice.invoiceCustomerBillingInfoAddress,
		countrySpecific: invoice.invoiceCustomerBillingInfoCz,
	});

	const totalAmount = invoice.items.reduce(
		(acc, value) => acc + value.totalAmount,
		0,
	);

	const czechBankAccount =
		invoice.paymentMethod === "bankTransfer" && invoice.paymentIban
			? parseCzechBankAccountFromIban(invoice.paymentIban)
			: null;

	return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.2">
  <DocumentType>1</DocumentType>
  <ID>${invoice.invoiceNumber}</ID>
  <UUID>${invoice.invoiceId}</UUID>
  <IssuingSystem>Finito</IssuingSystem>
  <IssueDate>${invoice.issueDate}</IssueDate>
  <VATApplicable>${invoice.invoiceSupplierBillingInfoCz.vatPayer}</VATApplicable>
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
      <PaymentMeansCode>${mapPaymentMethodToNumber[invoice.paymentMethod]}</PaymentMeansCode>
      <Details>
        <PaymentDueDate>${invoice.dueDate}</PaymentDueDate>
        <ID>${invoice.invoiceNumber}</ID>
        ${czechBankAccount !== null ? `<BankCode>${czechBankAccount.split("/")[1]}</BankCode>` : ""}
        ${invoice.paymentMethod === "bankTransfer" ? `<IBAN>${invoice.paymentIban}</IBAN>` : ""}
        <VariableSymbol>${invoice.invoiceNumber}</VariableSymbol>
      </Details>
    </Payment>
  </PaymentMeans>
</Invoice>
`;
};
