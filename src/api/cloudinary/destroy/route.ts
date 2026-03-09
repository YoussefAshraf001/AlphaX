import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const PUBLIC_ID_PATTERN =
  /^playcrew\/users\/[A-Za-z0-9_-]+\/(?:(avatar|wallpaper)|screenshots\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)$/;

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

    const body = (await req.json()) as { publicId?: string };
    const publicId = body.publicId?.trim();

    if (!publicId || !PUBLIC_ID_PATTERN.test(publicId)) {
      return NextResponse.json(
        { error: "Invalid public_id." },
        { status: 400 },
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = [
      "invalidate=true",
      `public_id=${publicId}`,
      `timestamp=${timestamp}`,
    ].join("&");

    const signature = crypto
      .createHash("sha1")
      .update(paramsToSign + apiSecret)
      .digest("hex");

    const form = new URLSearchParams();
    form.set("public_id", publicId);
    form.set("api_key", apiKey);
    form.set("timestamp", String(timestamp));
    form.set("signature", signature);
    form.set("invalidate", "true");

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      },
    );

    const json = (await res.json()) as { result?: string; error?: unknown };
    if (!res.ok || json.error) {
      return NextResponse.json(
        { error: "Cloudinary destroy failed.", details: json },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, result: json.result ?? "unknown" });
  } catch (error) {
    console.error("Cloudinary destroy route failed", error);
    return NextResponse.json(
      { error: "Could not destroy image." },
      { status: 500 },
    );
  }
}
