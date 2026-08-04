"use client";

import { Check, Loader2, Move, RotateCw, Sparkles, X, ZoomIn, ZoomOut } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";

interface AvatarCropModalProps {
  imageSrc: string;
  isOpen: boolean;
  onClose: () => void;
  onCropSave: (compressedDataUrl: string) => Promise<void>;
}

export function AvatarCropModal({
  imageSrc,
  isOpen,
  onClose,
  onCropSave,
}: AvatarCropModalProps) {
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [saving, setSaving] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const imageRef = React.useRef<HTMLImageElement | null>(null);

  // Carrega a imagem original ao abrir o modal
  React.useEffect(() => {
    if (!imageSrc || !isOpen) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
      drawCanvas(img, 1, 0, { x: 0, y: 0 });
    };
  }, [imageSrc, isOpen]);

  // Função para desenhar a imagem no Canvas de visualização
  const drawCanvas = React.useCallback(
    (
      img: HTMLImageElement | null,
      currentZoom: number,
      currentRotation: number,
      currentOffset: { x: number; y: number },
    ) => {
      const canvas = canvasRef.current;
      if (!canvas || !img) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const size = 320; // tamanho do canvas na tela
      canvas.width = size;
      canvas.height = size;

      // Limpar canvas
      ctx.clearRect(0, 0, size, size);

      // Fundo escuro sutil
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, size, size);

      ctx.save();
      // Mover para o centro do canvas
      ctx.translate(size / 2 + currentOffset.x, size / 2 + currentOffset.y);
      ctx.rotate((currentRotation * Math.PI) / 180);
      ctx.scale(currentZoom, currentZoom);

      // Calcular escala inicial para ajustar a imagem ao quadrado do canvas
      const scale = Math.max(size / img.width, size / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      // Máscara circular com borda estilo guia de foto de perfil
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
      ctx.beginPath();
      ctx.rect(0, 0, size, size);
      ctx.arc(size / 2, size / 2, size / 2 - 16, 0, Math.PI * 2, true);
      ctx.fill();

      // Guia circular de enquadramento
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
    [],
  );

  React.useEffect(() => {
    if (imageRef.current) {
      drawCanvas(imageRef.current, zoom, rotation, offset);
    }
  }, [zoom, rotation, offset, drawCanvas]);

  // Handlers para arrastar e enquadrar a foto
  function handleMouseDown(e: React.MouseEvent) {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    setIsDragging(true);
    setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging) return;
    const touch = e.touches[0];
    if (!touch) return;
    setOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  }

  // Gera o corte final em 400x400 px com compressão JPEG/WebP de alta performance
  async function handleConfirmCrop() {
    const img = imageRef.current;
    if (!img) return;

    setSaving(true);
    try {
      const outputCanvas = document.createElement("canvas");
      const outSize = 400; // Resolução ideal de foto de perfil (400x400)
      outputCanvas.width = outSize;
      outputCanvas.height = outSize;

      const ctx = outputCanvas.getContext("2d");
      if (!ctx) throw new Error("Falha ao criar contexto 2D");

      // Preenchimento de fundo para evitar transparências estranhas
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outSize, outSize);

      ctx.save();
      // Recalcular proporções para a resolução final de 400px
      const displayScale = outSize / 320;
      ctx.translate(outSize / 2 + offset.x * displayScale, outSize / 2 + offset.y * displayScale);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);

      const baseScale = Math.max(outSize / img.width, outSize / img.height);
      const drawW = img.width * baseScale;
      const drawH = img.height * baseScale;

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      // Compressão automática em JPEG 82% qualidade (~30KB)
      const compressedDataUrl = outputCanvas.toDataURL("image/jpeg", 0.82);
      await onCropSave(compressedDataUrl);
      onClose();
    } catch (err) {
      console.error("Erro ao cortar foto:", err);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card text-card-foreground w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl space-y-4 p-5">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-base font-bold tracking-tight">Cortar e Enquadrar Foto</h3>
            <p className="text-muted-foreground text-xs">Arraste e ajuste para alinhar seu rosto</p>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-accent text-muted-foreground rounded-lg p-1 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Área interativa de enquadramento (Canvas) */}
        <div className="relative grid place-items-center">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
            className="cursor-move rounded-xl touch-none select-none shadow-inner border border-border/60"
          />

          <div className="bg-background/80 text-foreground pointer-events-none absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-xs border shadow-xs">
            <Move className="size-3 text-primary" /> Arraste para mover
          </div>
        </div>

        {/* Controles de Zoom e Rotação */}
        <div className="space-y-3 bg-muted/40 rounded-xl p-3.5 border">
          <div className="flex items-center gap-3">
            <ZoomOut className="text-muted-foreground size-4" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="seek flex-1"
            />
            <ZoomIn className="text-muted-foreground size-4" />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="text-primary size-3.5" />
              <span>Compressão automática ativada (400x400 · WebP/JPEG)</span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              title="Girar 90°"
            >
              <RotateCw className="size-3.5" /> Girar
            </Button>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-3 border-t pt-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="gradient" onClick={handleConfirmCrop} loading={saving}>
            <Check className="size-4" /> Salvar e Aplicar Foto
          </Button>
        </div>
      </div>
    </div>
  );
}
