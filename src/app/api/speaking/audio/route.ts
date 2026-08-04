import { NextResponse, type NextRequest } from "next/server";

import { getSessionContext } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const sessionId = searchParams.get("sessionId");

  const supabase = await createServerSupabase();

  let targetPath = path;

  if (!targetPath && sessionId) {
    const { data: sessionRow } = await supabase
      .from("speaking_sessions")
      .select("audio_path, user_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionRow && (sessionRow.user_id === session.userId || session.profile.role === "admin")) {
      targetPath = sessionRow.audio_path;
    }
  }

  if (!targetPath) {
    return NextResponse.json({ error: "Caminho do áudio não especificado" }, { status: 400 });
  }

  // Garantir autorização do usuário ou admin
  if (!targetPath.startsWith(`${session.userId}/`) && session.profile.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado ao áudio" }, { status: 403 });
  }

  const { data, error } = await supabase.storage.from("speaking-audio").download(targetPath);

  if (error || !data) {
    console.error("[speaking/audio] Erro ao carregar áudio:", error?.message);
    return NextResponse.json({ error: "Áudio não encontrado" }, { status: 404 });
  }

  const arrayBuffer = await data.arrayBuffer();
  const ext = targetPath.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "mp4" || ext === "m4a"
      ? "audio/mp4"
      : ext === "ogg"
        ? "audio/ogg"
        : ext === "mp3"
          ? "audio/mpeg"
          : ext === "wav"
            ? "audio/wav"
            : "audio/webm";

  return new Response(arrayBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(arrayBuffer.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
