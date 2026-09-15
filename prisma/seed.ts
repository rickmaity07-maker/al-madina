import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up old database records...');
  // Delete sizes first to avoid foreign key constraint errors, then delete products
  await prisma.productSize.deleteMany();
  await prisma.product.deleteMany();

  console.log('Seeding database with Arabic grocery items and live images...');

  const products = [
    {
      name: 'Medjool Dates',
      description: 'Premium quality sweet dates',
      category: 'Groceries',
      image: 'https://images.unsplash.com/photo-1596450514735-e102660d3d52?auto=format&fit=crop&w=800&q=80',
      sizes: { create: [{ label: '500g', price: 6.99, stock: 50 }] }
    },
    {
      name: 'Fresh Pita Bread',
      description: 'Authentic Lebanese pita breads',
      category: 'Bakery',
      image: 'https://images.unsplash.com/photo-1593504049359-74330189a345?auto=format&fit=crop&w=800&q=80',
      sizes: { create: [{ label: 'Pack of 6', price: 1.99, stock: 100 }] }
    },
    {
      name: 'Tahini Paste',
      description: '100% ground roasted sesame seeds',
      category: 'Pantry',
      image: 'https://images.unsplash.com/photo-1511690078903-71dc5a49f5e3?auto=format&fit=crop&w=800&q=80',
      sizes: { create: [{ label: '300g', price: 4.49, stock: 30 }] }
    },
    {
      name: "Za'atar Spice Blend",
      description: 'Traditional wild thyme and sesame mix',
      category: 'Spices',
      image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
      sizes: { create: [{ label: '150g', price: 3.99, stock: 40 }] }
    },
    {
      name: 'Labneh',
      description: 'Thick and creamy strained yogurt',
      category: 'Dairy',
      image: 'https://images.unsplash.com/photo-1571212515416-fba498cb3d7f?auto=format&fit=crop&w=800&q=80',
      sizes: { create: [{ label: '400g', price: 3.49, stock: 25 }] }
    },
    {
      name: 'Turkish Coffee',
      description: 'Finely ground dark roast coffee',
      category: 'Beverages',
      image: 'https://images.unsplash.com/photo-1541513689408-fb36cd40e4f2?auto=format&fit=crop&w=800&q=80',
      sizes: { create: [{ label: '250g', price: 5.99, stock: 60 }] }
    }
  ];

  for (const p of products) {
    await prisma.product.create({
      data: p,
    });
  }

  console.log('Seeding complete! Images added. 📸🚀');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });