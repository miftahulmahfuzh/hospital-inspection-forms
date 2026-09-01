import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  checkCredentials,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const { username, password } = (payload ?? {}) as {
    username?: unknown;
    password?: unknown;
  };
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Nama pengguna dan kata sandi wajib diisi." },
      { status: 400 },
    );
  }

  try {
    if (!checkCredentials(username, password)) {
      // Deliberately vague: don't reveal which field was wrong.
      return NextResponse.json(
        { error: "Nama pengguna atau kata sandi salah." },
        { status: 401 },
      );
    }
    const token = await createSessionToken(username);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (err) {
    console.error("login misconfigured", err);
    return NextResponse.json(
      { error: "Login belum dikonfigurasi di server." },
      { status: 500 },
    );
  }
}
