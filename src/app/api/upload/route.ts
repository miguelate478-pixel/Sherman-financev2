import { NextRequest } from 'next/server';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { findCompanyById, createDocument, createDocumentLine, updateDocument, createAuditLog } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized, getIP } from '@/lib/response';
import { getAiProvider } from '@/lib/providers/ai';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  try {
    const formData  = await req.formData();
    const companyId = formData.get('companyId') as string;
    const operation = (formData.get('operation') as string) || 'COMPRA';
    const period    = (formData.get('period')    as string) || new Date().toISOString().slice(0,7);
    const parseXml  = formData.get('parseXml')   === 'true';
    const classifyAI= formData.get('classifyAI') === 'true';
    if (!companyId) return err('companyId requerido');
    const company = await findCompanyById(companyId);
    if (!company) return err('Empresa no encontrada');
    const files = formData.getAll('files') as File[];
    if (!files.length) return err('Sin archivos');
    const ai = getAiProvider();
    const results: Record<string,unknown>[] = [];

    for (const file of files) {
      try {
        const bytes  = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const hash   = createHash('sha256').update(buffer).digest('hex');
        const name   = file.name;
        const isCdr  = name.startsWith('R-');
        const isPdf  = name.endsWith('.pdf');
        const isXml  = name.endsWith('.xml') && !isCdr;

        // Parse filename: {RUC}-{TT}-{Serie}-{Num}.xml
        const clean = name.replace('.xml','').replace('.pdf','').replace('R-','');
        const parts = clean.split('-');
        const docType   = parts[1] || '01';
        const serie     = parts[2] || 'F001';
        const numero    = parts[3] || '000001';
        const rucEmisor = parts[0] || company.ruc as string;
        const docId     = `${serie}-${numero}-${period}-upload`;

        // Storage
        const base = process.env.STORAGE_PATH || './storage';
        const dir  = join(base,'sunat',company.ruc as string,period,operation.toLowerCase(),docType,`${serie}-${numero}`);
        mkdirSync(dir, { recursive: true });
        const filename = isCdr ? 'cdr.xml' : isPdf ? 'document.pdf' : 'document.xml';
        writeFileSync(join(dir,filename), buffer);

        // Upsert document
        await createDocument({
          id:docId, companyId, operation,
          docType, serie, number:numero,
          issuerRuc:rucEmisor, issuerName:'Cargado manualmente',
          receiverRuc:company.ruc, receiverName:company.businessName,
          issueDate:new Date().toISOString().slice(0,10),
          currency:'PEN', base:0, igv:0, total:0,
          sunatStatus:'PENDIENTE', cdrStatus:'PENDIENTE',
          hasXml:isXml, hasPdf:isPdf, hasCdr:isCdr,
          xmlPath: isXml ? join(dir,'document.xml') : undefined,
          pdfPath: isPdf ? join(dir,'document.pdf') : undefined,
          cdrPath: isCdr ? join(dir,'cdr.xml') : undefined,
          hashSha256:hash, period, workflow:'PENDIENTE_REVISION',
          concarStatus:'PENDIENTE', parserStatus:'PENDIENTE', aiStatus:'PENDIENTE',
        });

        // Parse XML + classify
        if (isXml && parseXml) {
          try {
            const { parseXmlUbl } = await import('@/lib/xml-parser');
            const parsed = await parseXmlUbl(buffer.toString('utf8'));
            await updateDocument(docId, {
              issuerRuc: parsed.header.rucEmisor || rucEmisor,
              issuerName: parsed.header.rsEmisor || 'Cargado manualmente',
              receiverRuc: parsed.header.rucReceptor || company.ruc,
              receiverName: parsed.header.rsReceptor || company.businessName,
              issueDate: parsed.header.fechaEmision || new Date().toISOString().slice(0,10),
              currency: parsed.header.moneda || 'PEN',
              base: parsed.header.totalBase,
              igv: parsed.header.totalIgv,
              total: parsed.header.totalImporte,
              parserStatus:'PARSEADO',
            });
            for (const line of parsed.lines) {
              let cl = null;
              if (classifyAI) try { cl = await ai.classifyLine(line.description, line.lineTotal, docType); } catch {}
              await createDocumentLine({
                id:`${docId}-L${line.lineNumber}`, documentId:docId,
                lineNumber:line.lineNumber, code:line.code||'',
                description:line.description, quantity:line.quantity,
                unit:line.unit, unitValue:line.unitValue,
                igvAmount:line.igvAmount, lineTotal:line.lineTotal,
                affectType:line.affectType,
                pcgeAccount:cl?.pcgeAccount||null, costCenter:cl?.costCenter||null,
                category:cl?.category||null, iaConfidence:cl?.confidence||0,
                needsReview:cl?.needsReview||false, isRecurrent:cl?.isRecurrent||false,
              });
            }
            if (classifyAI) await updateDocument(docId, { aiStatus:'CLASIFICADO' });
          } catch (e) { console.warn('[UPLOAD PARSER]', name, e); }
        }

        results.push({ file:name, docId, hash, parsed:isXml&&parseXml, ok:true });
      } catch (fileErr) {
        results.push({ file:file.name, error:(fileErr as Error).message, ok:false });
      }
    }

    await createAuditLog({ userId:user.sub, userEmail:user.email, userRole:user.role, action:'FILES_UPLOADED', object:`${files.length} archivos`, ip:getIP(req) });
    return ok({ uploaded:results.filter(r=>r.ok).length, results });
  } catch (e) {
    return err(`Error: ${(e as Error).message}`, 500);
  }
}
