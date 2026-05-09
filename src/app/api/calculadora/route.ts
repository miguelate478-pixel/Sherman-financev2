import { NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/response";
import { queryAll } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  const period = searchParams.get("period") || new Date().toISOString().slice(0, 7);
  if (!companyId) return err("companyId requerido");

  const docs = await queryAll(
    `SELECT operation, SUM(ABS(igv)) as igv_sum, SUM(ABS(total)) as total_sum, SUM(ABS(base)) as base_sum
     FROM documents WHERE "companyId"=$1 AND period=$2
     GROUP BY operation`,
    [companyId, period]
  ) as Record<string, unknown>[];

  const comprasRow = docs.find(d => d.operation === "COMPRA");
  const ventasRow  = docs.find(d => d.operation === "VENTA");

  const igvCredito    = Number(comprasRow?.igv_sum  || 0);
  const igvDebito     = Number(ventasRow?.igv_sum   || 0);
  const igvNeto       = igvDebito - igvCredito;
  const ingresosNetos = Number(ventasRow?.base_sum  || 0);

  return ok({ igvCredito, igvDebito, igvNeto, ingresosNetos, period });
}
