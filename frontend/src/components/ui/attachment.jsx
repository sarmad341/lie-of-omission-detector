import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, ExternalLink, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Attachment({ file, url, isImage, onOpen, className }) {
  const ext = file ? file.split('.').pop().toUpperCase() : "FILE";
  return (
    <Card className={cn("overflow-hidden group flex flex-col border border-border bg-card w-[140px]", className)}>
      <div className="relative aspect-square bg-muted flex items-center justify-center border-b border-border overflow-hidden cursor-pointer" onClick={onOpen}>
        {isImage && url ? (
          <img src={url} alt={file} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex flex-col items-center text-muted-foreground">
            {isImage ? <ImageIcon size={32} className="mb-2 opacity-50" /> : <FileText size={32} className="mb-2 opacity-50" />}
            <span className="font-semibold text-xs opacity-75">{ext}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {onOpen && (
            <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-md" aria-label="Preview">
              <ExternalLink size={14} />
            </Button>
          )}
          {url && (
            <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-md" asChild aria-label="Download" onClick={(e) => e.stopPropagation()}>
              <a href={url} download target="_blank" rel="noreferrer">
                <Download size={14} />
              </a>
            </Button>
          )}
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-xs font-medium leading-tight truncate text-foreground" title={file}>{file}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{ext} Document</p>
      </div>
    </Card>
  );
}
