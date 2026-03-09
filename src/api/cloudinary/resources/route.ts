import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PUBLIC_ID_PATTERN =
  /^playcrew\/users\/[A-Za-z0-9_-]+\/(?:(avatar|wallpaper)|screenshots\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)$/;

type ResourceItem = {
  public_id?: string;
  bytes?: number;
};

export async function POST(req: Request) {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Cloudinary env vars are missing." },
        { status: 500 },
      );
    }

    const body = (await req.json()) as { publicIds?: string[] };
    const publicIdsRaw = Array.isArray(body.publicIds) ? body.publicIds : [];
    const publicIds = publicIdsRaw
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (!publicIds.length) {
      return NextResponse.json({ error: "No publicIds provided." }, { status: 400 });
    }
    if (publicIds.length > 50) {
      return NextResponse.json(
        { error: "Too many publicIds (max 50)." },
        { status: 400 },
      );
    }
    if (!publicIds.every((id) => PUBLIC_ID_PATTERN.test(id))) {
      return NextResponse.json(
        { error: "One or more publicIds are invalid." },
        { status: 400 },
      );
    }

    const params = new URLSearchParams();
    for (const id of publicIds) {
      params.append("public_ids[]", id);
    }

    const basicToken = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${basicToken}`,
        },
        cache: "no-store",
      },
    );

    const json = (await res.json()) as {
      resources?: ResourceItem[];
      error?: unknown;
    };

    if (!res.ok || json.error) {
      return NextResponse.json(
        { error: "Cloudinary resources lookup failed.", details: json },
        { status: 500 },
      );
    }

    const bytesByPublicId: Record<string, number> = {};
    for (const resource of json.resources ?? []) {
      if (
        typeof resource.public_id === "string" &&
        typeof resource.bytes === "number" &&
        Number.isFinite(resource.bytes)
      ) {
        bytesByPublicId[resource.public_id] = resource.bytes;
      }
    }

    return NextResponse.json({ bytesByPublicId });
  } catch (error) {
    console.error("Cloudinary resources route failed", error);
    return NextResponse.json(
      { error: "Could not fetch Cloudinary resources." },
      { status: 500 },
    );
  }
}
