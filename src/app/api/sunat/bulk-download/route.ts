import { NextRequest } from 'next/server';
import { findCompanyById, findDocumentById, getCredentialByCompany, createBulkJob, createBulkJobPeriod, updateBulkJob, updateBulkJobPeriod, getBulkJobs, createDocument, createDocumentLine, updateDocument, createAuditLog } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized, getIP } from '@/lib/response';
import { getSunatProvider, getStoragePath } from '@/lib/providers/sunat';
import { getAiProvider } from '@/lib/providers/ai';
import { decrypt } from '@/lib/crypto';

function getPeriods(from:string,to:string):string[]{const ps:string[]=[];let[y,m]=from.split('-').map(Number);const[ty,tm]=to.split('-').map(Number);while(y<ty||(y===ty&&m<=tm)){ps.push(`${y}-${String(m).padStart(2,'0')}`);m++;if(m>12){m=1;y++;}}return ps;}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  try {
    const body = await req.json();
    const { companyId, operation, periodFrom, periodTo, documentTypes, fileTypes, includeDetails, classifyWithAI } = body;
    if (!companyId||!periodFrom||!periodTo) return err('companyId, periodFrom y periodTo requeridos');

    const company = await findCompanyById(companyId);
    if (!company) return err('Empresa no encontrada');

    const cred = await getCredentialByCompany(companyId);
    let solPass = '';
    let clientId: string | null = null;
    let clientSecret: string | null = null;
    if (cred && process.env.SUNAT_PROVIDER==='direct') {
      solPass = decrypt(cred.encryptedPass as string, cred.iv as string, cred.authTag as string);
      clientId = cred.clientId as string | null;
      if (cred.encClientSecret) {
        try {
          const p = JSON.parse(cred.encClientSecret as string) as { enc:string; iv:string; tag:string };
          clientSecret = decrypt(p.enc, p.iv, p.tag);
        } catch {}
      }
    }

    const periods = getPeriods(periodFrom, periodTo);
    const ops = operation==='BOTH'?['COMPRAS','VENTAS']:[operation==='PURCHASES'?'COMPRAS':'VENTAS'];

    const jobId = await createBulkJob({ companyId, operation, periodFrom, periodTo, periodType:periods.length===1?'MONTHLY':'RANGE', totalPeriods:periods.length*ops.length, createdBy:user.email });

    const sunat = getSunatProvider();
    const ai    = getAiProvider();
    let totalDocs=0,totalXml=0,totalPdf=0,totalCdr=0,totalErrors=0;
    let lastError = '';

    let sireToken='';
    try {
      sireToken = await sunat.getSireToken(
        company.ruc as string,
        (cred?.solUser as string)||'',
        solPass,
        clientId ?? undefined,
        clientSecret ?? undefined
      );
    } catch(e) {
      console.error('[BULK] Error obteniendo SIRE token:', (e as Error).message);
    }

    for (const period of periods) {
      for (const op of ops) {
        const jpId = await createBulkJobPeriod({ jobId, period, operation:op });
        try {
          const result = await sunat.bulkDownload({
            ruc:           company.ruc as string,
            period,
            operation:     op as 'COMPRAS'|'VENTAS',
            documentTypes: documentTypes||['01','03','07','08'],
            sireToken:     sireToken || undefined,
            solUser:       (cred?.solUser as string)||'',
            solPass,
            clientId:      clientId ? clientId : undefined,
            clientSecret:  clientSecret ? clientSecret : undefined,
          });
          let periodXml=0,periodPdf=0,periodCdr=0,periodErrors=0;

          for (const doc of result.documents) {
            const docId=`${doc.serie}-${doc.numero}-${period}`;
            const existing = await findDocumentById(docId);
            if(existing) continue;

            const storePath=getStoragePath(company.ruc as string,period,op,doc.tipo,`${doc.serie}-${doc.numero}`);
            let xmlContent:string|undefined,hasXml=false,hasPdf=false,hasCdr=false,xmlPath='',pdfPath='',cdrPath='',docHash='';

            if(!fileTypes||fileTypes.includes('XML')){try{const r=await sunat.downloadXml(company.ruc as string,doc.id,storePath);if(r.success&&r.xmlContent){hasXml=true;xmlContent=r.xmlContent;docHash=r.hash||'';xmlPath=`${storePath}/document.xml`;periodXml++;}}catch{periodErrors++;}}
            if(!fileTypes||fileTypes.includes('PDF')){try{const r=await sunat.downloadPdf(company.ruc as string,doc.id,storePath);if(r.success){hasPdf=true;pdfPath=`${storePath}/document.pdf`;periodPdf++;}}catch{periodErrors++;}}
            if(!fileTypes||fileTypes.includes('CDR')){try{const r=await sunat.downloadCdr(company.ruc as string,doc.id,storePath);if(r.success){hasCdr=true;cdrPath=`${storePath}/cdr.xml`;periodCdr++;}}catch{periodErrors++;}}

            const base=Math.abs(doc.total)/1.18,igv=Math.abs(doc.total)-base;
            // Para VENTAS: el cliente viene en numDocCliente/razonSocialCliente (campos reales SUNAT)
            // Para COMPRAS: el proveedor viene en rucEmisor/rsEmisor
            const receiverRuc = op==='VENTAS'
              ? (doc.numDocCliente || doc.rucReceptor || '')
              : doc.rucReceptor;
            const receiverName = op==='VENTAS'
              ? (doc.razonSocialCliente || doc.rsReceptor || '')
              : doc.rsReceptor;
            await createDocument({id:docId,companyId,bulkJobId:jobId,operation:op==='COMPRAS'?'COMPRA':'VENTA',docType:doc.tipo,serie:doc.serie,number:doc.numero,issuerRuc:doc.rucEmisor,issuerName:doc.rsEmisor,receiverRuc,receiverName,issueDate:doc.fecha,currency:doc.moneda,base:parseFloat(base.toFixed(2)),igv:parseFloat(igv.toFixed(2)),total:doc.total,sunatStatus:doc.sunatStatus,cdrStatus:doc.cdrStatus,hasXml,hasPdf,hasCdr,xmlPath,pdfPath,cdrPath,hashSha256:docHash,period,workflow:'PENDIENTE_REVISION',concarStatus:'PENDIENTE',parserStatus:'PENDIENTE',aiStatus:'PENDIENTE'});

            if(includeDetails&&xmlContent){
              try{
                const{parseXmlUbl}=await import('@/lib/xml-parser');
                const parsed=await parseXmlUbl(xmlContent);
                for(const line of parsed.lines){
                  let cl=null;
                  if(classifyWithAI)try{cl=await ai.classifyLine(line.description,line.lineTotal,doc.tipo);}catch{}
                  await createDocumentLine({id:`${docId}-L${line.lineNumber}`,documentId:docId,lineNumber:line.lineNumber,code:line.code||'',description:line.description,quantity:line.quantity,unit:line.unit,unitValue:line.unitValue,igvAmount:line.igvAmount,lineTotal:line.lineTotal,affectType:line.affectType,pcgeAccount:cl?.pcgeAccount||null,costCenter:cl?.costCenter||null,category:cl?.category||null,iaConfidence:cl?.confidence||0,needsReview:cl?.needsReview||false,isRecurrent:cl?.isRecurrent||false});
                }
                await updateDocument(docId,{parserStatus:'PARSEADO',aiStatus:classifyWithAI?'CLASIFICADO':'PENDIENTE'});
              }catch{}
            }
          }

          await updateBulkJobPeriod(jpId,{status:'COMPLETADO',docsFound:result.docsFound,docsXml:periodXml,docsPdf:periodPdf,docsCdr:periodCdr,errors:periodErrors,completedAt:new Date().toISOString()});
          totalDocs+=result.docsFound;totalXml+=periodXml;totalPdf+=periodPdf;totalCdr+=periodCdr;totalErrors+=periodErrors;
        } catch(e) {
          const errMsg = (e as Error).message;
          console.error('[BULK ERROR] período:', period, 'op:', op, 'error:', errMsg);
          await updateBulkJobPeriod(jpId,{status:'ERROR',completedAt:new Date().toISOString()});
          totalErrors++;
          // Guardar el último error para incluirlo en la respuesta
          lastError = errMsg;
        }
      }
    }

    const finalStatus=totalErrors>0?'COMPLETADO_CON_ERRORES':'COMPLETADO';
    await updateBulkJob(jobId,{status:finalStatus,docsFound:totalDocs,docsXml:totalXml,docsPdf:totalPdf,docsCdr:totalCdr,errors:totalErrors,completedAt:new Date().toISOString()});
    await createAuditLog({userId:user.sub,userEmail:user.email,userRole:user.role,action:'BULK_DOWNLOAD_COMPLETADO',object:`${periodFrom}→${periodTo} ${operation} ${totalDocs}docs`,ip:getIP(req)});
    return ok({jobId,status:finalStatus,totalDocs,totalXml,totalPdf,totalCdr,totalErrors,lastError:lastError||undefined});
  } catch(e) { return err(`Error: ${(e as Error).message}`,500); }
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const p = new URL(req.url).searchParams;
  return ok(await getBulkJobs(p.get('companyId')||undefined));
}
