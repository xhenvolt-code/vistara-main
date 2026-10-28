import { prisma } from "@/server/db/prisma";

export async function GET() {
  const products = await prisma.accessProduct.findMany({
    where: { isAvailable: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      durationDays: true,
      priceUgx: true,
    },
  });

  return Response.json(
    { products },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
