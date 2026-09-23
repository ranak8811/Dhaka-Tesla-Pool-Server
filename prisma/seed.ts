import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding Dhaka Tesla Pool with Banani rush-hour cast...');

  const passwordHash = await bcrypt.hash('Tesla2026!', 10);

  // 1. Driver Jashim
  const jashim = await prisma.user.upsert({
    where: { email: 'jashim@dhakatesla.com' },
    update: {
      name: 'Jashim',
      passwordHash,
      role: 'DRIVER',
    },
    create: {
      email: 'jashim@dhakatesla.com',
      passwordHash,
      name: 'Jashim',
      role: 'DRIVER',
    },
  });

  // 2. Jashim's 3-seater electric Tesla "Bullet"
  const bullet = await prisma.vehicle.upsert({
    where: { driverId: jashim.id },
    update: {
      name: 'Bullet',
      maxCapacity: 3,
      isOnline: true,
      currentZone: 'Banani',
    },
    create: {
      driverId: jashim.id,
      name: 'Bullet',
      maxCapacity: 3,
      isOnline: true,
      currentZone: 'Banani',
    },
  });

  // 3. Passenger Nusrat (Banani to Mohakhali)
  const nusrat = await prisma.user.upsert({
    where: { email: 'nusrat@dhakatesla.com' },
    update: {
      name: 'Nusrat',
      passwordHash,
      role: 'PASSENGER',
    },
    create: {
      email: 'nusrat@dhakatesla.com',
      passwordHash,
      name: 'Nusrat',
      role: 'PASSENGER',
    },
  });

  // 4. Passenger Rafiq (Banani to Gulshan 1)
  const rafiq = await prisma.user.upsert({
    where: { email: 'rafiq@dhakatesla.com' },
    update: {
      name: 'Rafiq',
      passwordHash,
      role: 'PASSENGER',
    },
    create: {
      email: 'rafiq@dhakatesla.com',
      passwordHash,
      name: 'Rafiq',
      role: 'PASSENGER',
    },
  });

  // 5. Passenger Shirin (Banani rush hour contender for seat 3)
  const shirin = await prisma.user.upsert({
    where: { email: 'shirin@dhakatesla.com' },
    update: {
      name: 'Shirin',
      passwordHash,
      role: 'PASSENGER',
    },
    create: {
      email: 'shirin@dhakatesla.com',
      passwordHash,
      name: 'Shirin',
      role: 'PASSENGER',
    },
  });

  console.log('Seeding complete! Seeded:');
  console.log(`- Driver: ${jashim.name} (Vehicle: ${bullet.name}, Capacity: ${bullet.maxCapacity} seats, Online: ${bullet.isOnline}, Zone: ${bullet.currentZone})`);
  console.log(`- Passengers: ${nusrat.name}, ${rafiq.name}, ${shirin.name}`);
  console.log('Demo Password for all: Tesla2026!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
