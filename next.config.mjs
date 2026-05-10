/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "@libsql/client",
    "bcryptjs",
    "xml2js",
    "mssql",
    "nodemailer",
    "speakeasy",
    "qrcode",
    "puppeteer-core",
    "puppeteer",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
    "@sparticuz/chromium",
  ],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Type', value: 'text/html; charset=utf-8' },
        ],
      },
    ];
  },
};
export default nextConfig;
