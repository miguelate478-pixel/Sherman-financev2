import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Ver usuarios admin
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
    select: { email: true, role: true },
  });
  console.log('Admin user:', admin);
  
  // Ver credenciales SUNAT
  const cred = await prisma.credential.findFirst({
    where: { companyId: 1 },
  });
  console.log('\nSUNAT credentials:', {
    solUser: cred?.solUser,
    clientId: cred?.clientId,
    hasEncryptedPass: !!cred?.encryptedPass,
    hasClientSecret: !!cred?.encClientSecret,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
