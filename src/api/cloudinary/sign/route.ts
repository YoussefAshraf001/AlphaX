import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const PUBLIC_ID_PATTERN =
  /^playcrew\/users\/[A-Za-z0-9_-]+\/(?:(avatar|wallpaper)|screenshots\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)$/;
const ASSET_FOLDER_PATTERN =
  /^playcrew\/users\/[A-Za-z0-9_-]+\/(?:(avatar|wallpaper|profile)|screenshots\/[A-Za-z0-9_-]+)$/;

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

    const body = (await req.json()) as {
      publicId?: string;
      assetFolder?: string;
    };
    const publicId = body.publicId?.trim();
    const assetFolder = body.assetFolder?.trim();

    if (!publicId || !PUBLIC_ID_PATTERN.test(publicId)) {
      return NextResponse.json(
        { error: "Invalid public_id." },
        { status: 400 },
      );
    }
    if (assetFolder && !ASSET_FOLDER_PATTERN.test(assetFolder)) {
      return NextResponse.json(
        { error: "Invalid asset_folder." },
        { status: 400 },
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = [
      ...(assetFolder ? [`asset_folder=${assetFolder}`] : []),
      "invalidate=true",
      "overwrite=true",
      `public_id=${publicId}`,
      `timestamp=${timestamp}`,
    ].join("&");

    const signature = crypto
      .createHash("sha1")
      .update(paramsToSign + apiSecret)
      .digest("hex");

    return NextResponse.json({
      cloudName,
      apiKey,
      timestamp,
      signature,
      publicId,
      assetFolder: assetFolder ?? null,
    });
  } catch (error) {
    console.error("Cloudinary sign route failed", error);
    return NextResponse.json(
      { error: "Could not sign upload request." },
      { status: 500 },
    );
  }
}
