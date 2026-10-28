import { prisma } from "@/server/db/prisma";

export async function GET(request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120);
  const searchConditions = query
    ? [
        { title: { contains: query, mode: "insensitive" } },
        {
          genres: {
            some: {
              genre: { name: { contains: query, mode: "insensitive" } },
            },
          },
        },
        ...(Number.isInteger(Number(query))
          ? [{ releaseYear: Number(query) }]
          : []),
      ]
    : undefined;

  const movies = await prisma.movie.findMany({
    where: {
      status: "PUBLISHED",
      rightsStatus: "APPROVED",
      videoAssets: { some: { status: "READY" } },
      ...(searchConditions ? { OR: searchConditions } : {}),
    },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      synopsis: true,
      posterUrl: true,
      backdropUrl: true,
      releaseYear: true,
      runtimeMinutes: true,
      language: true,
      isFeatured: true,
      genres: {
        select: {
          genre: { select: { name: true } },
        },
      },
    },
  });

  return Response.json(
    { movies },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
