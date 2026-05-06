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
    "@sparticuz/chromium",
  ],
};
export default nextConfig;
