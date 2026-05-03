import { parseStringPromise } from 'xml2js';

export interface CpeHeader {
  rucEmisor: string; rsEmisor: string; rucReceptor: string; rsReceptor: string;
  tipoDoc: string; serie: string; numero: string; fechaEmision: string; moneda: string;
  totalBase: number; totalIgv: number; totalImporte: number; hash?: string;
}
export interface CpeLine {
  lineNumber: number; code?: string; description: string;
  quantity: number; unit: string; unitValue: number;
  igvAmount: number; lineTotal: number; affectType: string;
}
export interface CpeDocument { header: CpeHeader; lines: CpeLine[]; }

function getText(node: unknown): string {
  if (!node) return '';
  if (Array.isArray(node)) return getText((node as unknown[])[0]);
  if (typeof node === 'object' && node !== null) { const n = node as Record<string,unknown>; return n._ ? String(n._) : ''; }
  return String(node);
}
function getNum(node: unknown): number { return parseFloat(getText(node)) || 0; }
function arr(node: unknown): Record<string,unknown>[] {
  if (!node) return [];
  if (Array.isArray(node)) return node as Record<string,unknown>[];
  return [];
}

export async function parseXmlUbl(xmlContent: string): Promise<CpeDocument> {
  const raw = await parseStringPromise(xmlContent, { explicitArray: true, ignoreAttrs: false }) as Record<string,unknown>;
  const root = (raw['Invoice'] ?? raw['CreditNote'] ?? raw['DebitNote'] ?? raw) as Record<string,unknown>;

  const sParty = arr(arr(root['cac:AccountingSupplierParty'])[0]?.['cac:Party'] as unknown[])[0] as Record<string,unknown>;
  const cParty = arr(arr(root['cac:AccountingCustomerParty'])[0]?.['cac:Party'] as unknown[])[0] as Record<string,unknown>;

  const header: CpeHeader = {
    rucEmisor:    getText(arr(sParty?.['cac:PartyTaxScheme'] as unknown[])[0]?.['cbc:CompanyID']),
    rsEmisor:     getText(arr(sParty?.['cac:PartyLegalEntity'] as unknown[])[0]?.['cbc:RegistrationName']),
    rucReceptor:  getText(arr(cParty?.['cac:PartyTaxScheme'] as unknown[])[0]?.['cbc:CompanyID']),
    rsReceptor:   getText(arr(cParty?.['cac:PartyLegalEntity'] as unknown[])[0]?.['cbc:RegistrationName']),
    tipoDoc:      getText(root['cbc:InvoiceTypeCode'] ?? root['cbc:CreditNoteTypeCode'] ?? root['cbc:DebitNoteTypeCode']),
    serie:        getText(root['cbc:ID'])?.split('-')[0] ?? '',
    numero:       getText(root['cbc:ID'])?.split('-')[1] ?? '',
    fechaEmision: getText(root['cbc:IssueDate']),
    moneda:       getText(root['cbc:DocumentCurrencyCode']) || 'PEN',
    totalBase:    getNum(arr(arr(root['cac:TaxTotal'])[0]?.['cac:TaxSubtotal'] as unknown[])[0]?.['cbc:TaxableAmount']),
    totalIgv:     getNum(arr(root['cac:TaxTotal'])[0]?.['cbc:TaxAmount']),
    totalImporte: getNum(arr(root['cac:LegalMonetaryTotal'])[0]?.['cbc:PayableAmount']),
  };

  const lines: CpeLine[] = arr(root['cac:InvoiceLine'] ?? root['cac:CreditNoteLine'] ?? root['cac:DebitNoteLine']).map((l, idx) => {
    const item   = arr(l['cac:Item'] as unknown[])[0] as Record<string,unknown>;
    const itemId = arr(item?.['cac:SellersItemIdentification'] as unknown[])[0];
    const qty    = (l['cbc:InvoicedQuantity'] ?? l['cbc:CreditedQuantity'] ?? l['cbc:DebitedQuantity']) as unknown[];
    const qArr   = arr(qty);
    const unit   = (qArr[0] as Record<string, Record<string,string>>)?.['$']?.unitCode ?? 'ZZ';
    const tax    = arr(l['cac:TaxTotal'] as unknown[])[0];
    const taxSub = arr((tax as Record<string,unknown>)?.['cac:TaxSubtotal'] as unknown[])[0];
    const taxCat = arr((taxSub as Record<string,unknown>)?.['cac:TaxCategory'] as unknown[])[0];
    return {
      lineNumber:  idx + 1,
      code:        getText(itemId?.['cbc:ID']),
      description: getText(item?.['cbc:Description']),
      quantity:    getNum(qty),
      unit,
      unitValue:   getNum(arr(l['cac:Price'] as unknown[])[0]?.['cbc:PriceAmount']),
      igvAmount:   getNum((tax as Record<string,unknown>)?.['cbc:TaxAmount']),
      lineTotal:   getNum(l['cbc:LineExtensionAmount']),
      affectType:  getText((taxCat as Record<string,unknown>)?.['cbc:TaxExemptionReasonCode']) || '10',
    };
  });

  return { header, lines };
}
