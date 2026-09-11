import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { FORM_BY_SLUG, allQuestions } from "@/lib/forms";

export const runtime = "nodejs";

type ClientPayload = { formSlug?: string; questionId?: string };

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const payload: ClientPayload = clientPayload ? JSON.parse(clientPayload) : {};
        const form = payload.formSlug ? FORM_BY_SLUG[payload.formSlug] : undefined;
        const question = form
          ? allQuestions(form).find((q) => q.id === payload.questionId)
          : undefined;

        if (!form || !question || question.type !== "file") {
          throw new Error("Unggahan tidak dikenali untuk formulir/pertanyaan ini.");
        }

        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "application/pdf",
          ],
          maximumSizeInBytes: (question.maxSizeMB ?? 10) * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ formSlug: form.slug, questionId: question.id }),
        };
      },
      onUploadCompleted: async () => {
        // Nothing to persist here — the browser attaches the returned URL to its
        // answers map and it rides along with the normal /api/submit POST. (This
        // callback also won't fire against a localhost dev server, since Blob needs
        // a public URL to call back to — that's expected, not a bug.)
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unggah gagal." },
      { status: 400 },
    );
  }
}
