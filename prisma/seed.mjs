import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  {
    name: "Extra Virgin Olive Oil",
    category: "Pantry",
    badge: "Beliebt",
    image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=900&q=85",
    sizes: [
      { label: "500ml", price: 5.49 },
      { label: "1L", price: 8.49, oldPrice: 10.99 },
      { label: "5L", price: 32.99 },
    ],
  },
  {
    name: "Turkish Red Lentils",
    category: "Pantry",
    image: "https://images.unsplash.com/photo-1515543904379-3d757afe72e4?auto=format&fit=crop&w=900&q=85",
    sizes: [
      { label: "500g", price: 2.29 },
      { label: "1kg", price: 3.99 },
    ],
  },
  {
    name: "Fresh Turkish Tomatoes",
    category: "Fresh",
    badge: "Heute frisch",
    unitNote: "per kg",
    image: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=900&q=85",
    sizes: [
      { label: "500g", price: 1.59 },
      { label: "1kg", price: 2.99 },
    ],
  },
  {
    name: "Green Turkish Olives",
    category: "Pantry",
    image: "https://images.unsplash.com/photo-1504274066651-8d31a536b11a?auto=format&fit=crop&w=900&q=85",
    sizes: [
      { label: "250g", price: 3.29 },
      { label: "500g", price: 5.49 },
    ],
  },
  {
    name: "Simit Sesame Bread",
    category: "Bakery",
    badge: "Heute gebacken",
    unitNote: "per piece",
    image: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=900&q=85",
    sizes: [
      { label: "1 piece", price: 1.49 },
      { label: "Pack of 4", price: 4.99 },
    ],
  },
  {
    name: "Ayran Yogurt Drink",
    category: "Chilled",
    image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=900&q=85",
    sizes: [
      { label: "0.5L", price: 1.29 },
      { label: "1.5L", price: 2.79 },
    ],
  },
  {
    name: "Turkish Pistachio Baklava",
    category: "Sweets",
    image: "https://images.unsplash.com/photo-1519671282424-7f1d4c2b6f7a?auto=format&fit=crop&w=900&q=85",
    sizes: [
      { label: "250g box", price: 6.99 },
      { label: "500g box", price: 12.49 },
    ],
  },
  {
    name: "Sumac Spice",
    category: "Spices",
    image: "https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&w=900&q=85",
    sizes: [{ label: "100g", price: 3.79 }],
  },
  {
    name: "Turkish Black Tea",
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&w=900&q=85",
    sizes: [
      { label: "400g", price: 5.99 },
      { label: "1kg", price: 12.99 },
    ],
  },
  {
    name: "Yufka Pastry Sheets",
    category: "Bakery",
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=85",
    sizes: [{ label: "Pack (500g)", price: 2.79 }],
  },
  {
    name: "Pomegranate Molasses",
    category: "Pantry",
    image: "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=900&q=85",
    sizes: [
      { label: "330ml", price: 4.59 },
      { label: "700ml", price: 7.99 },
    ],
  },
  {
    name: "Fresh Mint Bunch",
    category: "Fresh",
    badge: "Heute frisch",
    unitNote: "per bunch",
    image: "https://images.unsplash.com/photo-1628556270448-4d4e4141e6c4?auto=format&fit=crop&w=900&q=85",
    sizes: [{ label: "1 bunch", price: 1.19 }],
  },
];

async function main() {
  const count = await prisma.product.count();
  if (count > 0) {
    console.log(`Database already has ${count} product(s) — skipping seed. Delete dev.db to reseed from scratch.`);
    return;
  }

  for (const [i, p] of products.entries()) {
    await prisma.product.create({
      data: {
        name: p.name,
        category: p.category,
        badge: p.badge,
        unitNote: p.unitNote,
        image: p.image,
        sortOrder: i,
        sizes: {
          create: p.sizes.map((s, j) => ({
            label: s.label,
            price: s.price,
            oldPrice: s.oldPrice,
            sortOrder: j,
          })),
        },
      },
    });
  }

  console.log(`Seeded ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
