import { PrismaClient } from "../generated/prisma";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// Free user default credentials:  free@vdogen.local / FreePass123!
// Prime user default credentials: prime@vdogen.local / PrimePass123!
const SEED_USERS = [
  {
    name: "Free User",
    email: "free@vdogen.local",
    password: "FreePass123!",
    prime: false,
  },
  {
    name: "Prime User",
    email: "prime@vdogen.local",
    password: "PrimePass123!",
    prime: true,
  },
];

async function main() {
  const bcryptSaltRounds = 12;
  const yearMs = 365 * 24 * 60 * 60 * 1000;

  for (const seed of SEED_USERS) {
    const identity = await prisma.userIdentities.findUnique({
      where: {
        provider_providerSub: {
          provider: "Email",
          providerSub: seed.email,
        },
      },
    });

    if (identity) {
      console.log(`[seed] skipping existing identity: ${seed.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(seed.password, bcryptSaltRounds);

    await prisma.user.create({
      data: {
        name: seed.name,
        email: seed.email,
        // prime starts 1 year from now; free has no expiry (null)
        primeExpiry: seed.prime ? new Date(Date.now() + yearMs) : null,
        userIdentities: {
          create: {
            provider: "Email",
            providerSub: seed.email,
            email: seed.email,
            password: passwordHash,
          },
        },
      },
    });

    console.log(`[seed] created ${seed.name} (${seed.email}) [prime=${seed.prime}]`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());