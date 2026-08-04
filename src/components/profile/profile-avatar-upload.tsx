"use client";

import { Camera, Trash2, User } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { updateAvatarAction } from "@/app/app/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/types/database";
import { initials } from "@/lib/utils";

import { AvatarCropModal } from "./avatar-crop-modal";

export function ProfileAvatarUpload({ profile }: { profile: Profile }) {
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(profile.avatar_url);
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Manipula a seleção de arquivo do usuário
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem válido.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setSelectedImage(result);
        setIsCropOpen(true);
      }
    };
    reader.readAsDataURL(file);

    // Reseta o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = "";
  }

  // Salva a foto cortada e otimizada
  async function handleCropSave(compressedDataUrl: string) {
    try {
      const res = await updateAvatarAction(compressedDataUrl);
      if (!res.ok) throw new Error(res.error ?? "Falha ao salvar foto");

      setAvatarUrl(compressedDataUrl);
      toast.success("Foto de perfil atualizada com sucesso!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar foto";
      toast.error(message);
    }
  }

  // Remove a foto de perfil
  async function handleRemoveAvatar() {
    try {
      const res = await updateAvatarAction("");
      if (!res.ok) throw new Error(res.error ?? "Falha ao remover foto");

      setAvatarUrl(null);
      toast.success("Foto de perfil removida.");
    } catch (err) {
      toast.error("Erro ao remover foto de perfil.");
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="relative group">
        <Avatar className="size-24 border-2 border-primary/20 shadow-md">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={profile.full_name ?? ""} /> : null}
          <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
            {initials(profile.full_name ?? profile.email)}
          </AvatarFallback>
        </Avatar>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="bg-primary text-primary-foreground absolute bottom-0 right-0 grid size-8 place-items-center rounded-full shadow-lg transition-transform hover:scale-110"
          aria-label="Alterar foto"
          title="Alterar foto de perfil"
        >
          <Camera className="size-4" />
        </button>
      </div>

      <div className="space-y-1.5 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="size-4" /> Alterar foto
          </Button>

          {avatarUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveAvatar}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-4" /> Remover
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">
          Enquadramento interativo e compressão automática de imagem (WebP/JPEG otimizado).
        </p>
      </div>

      {selectedImage ? (
        <AvatarCropModal
          imageSrc={selectedImage}
          isOpen={isCropOpen}
          onClose={() => setIsCropOpen(false)}
          onCropSave={handleCropSave}
        />
      ) : null}
    </div>
  );
}
