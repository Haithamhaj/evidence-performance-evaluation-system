import { NextResponse } from "next/server";
import { z } from "zod";

import { uploadPrivateCaptureSource } from "../../../../platform/workspace-api";

const MAX_PRIVATE_CAPTURE_BYTES = 10 * 1024 * 1024;
const PrivateCaptureUploadSchema = z.object({ id: z.string().uuid() }).passthrough();

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const form = await request.formData();
    if ([...form.keys()].some((key) => key !== "file"))
      return NextResponse.json({}, { status: 400 });
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > MAX_PRIVATE_CAPTURE_BYTES) {
      return NextResponse.json({}, { status: 400 });
    }
    return NextResponse.json(
      await uploadPrivateCaptureSource({
        bytes: await file.arrayBuffer(),
        declaredMime: file.type,
        filename: file.name,
        schema: PrivateCaptureUploadSchema,
      }),
    );
  } catch {
    return NextResponse.json({}, { status: 500 });
  }
}
