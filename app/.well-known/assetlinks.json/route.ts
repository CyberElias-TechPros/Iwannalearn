import { NextResponse } from "next/server";

/** Set the release certificate SHA-256 fingerprints at deployment to enable
 * verified Android App Links. No fingerprint is invented for a debug build. */
export async function GET() {
  try {
    const fingerprints = JSON.parse(process.env.ANDROID_CERT_FINGERPRINTS ?? "[]");
    if (!Array.isArray(fingerprints) || !fingerprints.every((v) => typeof v === "string" && /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/i.test(v))) return NextResponse.json([], { status: 200 });
    return NextResponse.json([{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "app.iwannalearn.android", sha256_cert_fingerprints: fingerprints } }]);
  } catch { return NextResponse.json([]); }
}
