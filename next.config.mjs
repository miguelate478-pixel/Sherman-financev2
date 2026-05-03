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
  ],
};
export default nextConfig;
