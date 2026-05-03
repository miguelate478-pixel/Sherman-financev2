import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sherman Finance Control AI — Contabilidad SUNAT/SIRE automatizada',
  description: 'Automatiza tu contabilidad peruana: descarga masiva SUNAT/SIRE, parser XML UBL 2.1, clasificación IA PCGE, CONCAR SQL, conciliación bancaria. 30 días gratis.',
  keywords: 'SUNAT, SIRE, CONCAR, contabilidad peru, automatizacion contable, XML UBL 2.1, IGV, PCGE',
  openGraph: {
    title: 'Sherman Finance Control AI',
    description: 'Contabilidad peruana automatizada con IA — SUNAT/SIRE + CONCAR SQL',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%2322D3EE'/><text y='.9em' font-size='80' font-weight='900' fill='%23030712'>S</text></svg>"/>
      </head>
      <body style={{margin:0,padding:0}}>{children}</body>
    </html>
  );
}
