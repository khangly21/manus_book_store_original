import { useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Upload, FileText, CheckCircle2, AlertCircle, Trash2,
  Shield, Copy, Download, Loader2, File
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface BookFileUploaderProps {
  bookId: number;
  bookTitle: string;
  currentFile?: {
    fileName?: string | null;
    fileSize?: number | null;
    fileHash?: string | null;
    fileMimeType?: string | null;
    fileUrl?: string | null;
  };
  onUploadSuccess?: (fileHash: string) => void;
  onRemoveSuccess?: () => void;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/epub+zip",
  "application/octet-stream",
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getMimeType(file: File): "application/pdf" | "application/epub+zip" | "application/octet-stream" {
  if (file.type === "application/pdf") return "application/pdf";
  if (file.type === "application/epub+zip" || file.name.endsWith(".epub")) return "application/epub+zip";
  return "application/octet-stream";
}

export default function BookFileUploader({
  bookId,
  bookTitle,
  currentFile,
  onUploadSuccess,
  onRemoveSuccess,
}: BookFileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [localFileInfo, setLocalFileInfo] = useState<{
    name: string; size: number; hash: string; mimeType: string;
  } | null>(null);

  const uploadMutation = trpc.books.uploadFile.useMutation({
    onSuccess: (data) => {
      setIsUploading(false);
      setUploadProgress(100);
      toast.success("File uploaded successfully!", {
        description: `SHA-256: ${data.fileHash.slice(0, 16)}...`,
      });
      onUploadSuccess?.(data.fileHash);
    },
    onError: (err) => {
      setIsUploading(false);
      setUploadProgress(0);
      toast.error("Upload failed", { description: err.message });
    },
  });

  const removeMutation = trpc.books.removeFile.useMutation({
    onSuccess: () => {
      setLocalFileInfo(null);
      setUploadProgress(0);
      toast.success("File removed");
      onRemoveSuccess?.();
    },
    onError: (err) => toast.error("Remove failed", { description: err.message }),
  });

  const processFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large", { description: "Maximum file size is 50 MB" });
      return;
    }
    const mimeType = getMimeType(file);
    setIsUploading(true);
    setUploadProgress(10);

    // Read file as ArrayBuffer, then compute SHA-256 in the browser for preview
    const arrayBuffer = await file.arrayBuffer();
    setUploadProgress(30);

    // Compute SHA-256 in browser using Web Crypto API
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const rawHash = new Uint8Array(hashBuffer);
    const hashArray: number[] = [];
    for (let i = 0; i < rawHash.length; i++) hashArray.push(rawHash[i]!);
    const clientHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    setUploadProgress(50);

    // Convert to base64 for tRPC transport
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      const chunk = uint8.slice(i, i + chunkSize);
      const nums: number[] = [];
      for (let j = 0; j < chunk.length; j++) nums.push(chunk[j]!);
      binary += String.fromCharCode(...nums);
    }
    const base64Data = btoa(binary);
    setUploadProgress(70);

    setLocalFileInfo({ name: file.name, size: file.size, hash: clientHash, mimeType });

    // Upload via tRPC (server will recompute hash to confirm integrity)
    uploadMutation.mutate({ bookId, fileName: file.name, mimeType, base64Data });
  }, [bookId, uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }, [processFile]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const hasFile = localFileInfo
    ? true
    : !!(currentFile?.fileName);

  const displayFile = localFileInfo
    ? { fileName: localFileInfo.name, fileSize: localFileInfo.size, fileHash: localFileInfo.hash, fileMimeType: localFileInfo.mimeType }
    : currentFile;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {!hasFile && !isUploading && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
            ${isDragging
              ? "border-primary bg-primary/10 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-secondary/50"
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.epub"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isDragging ? "bg-primary/20" : "bg-secondary"}`}>
              <Upload className={`w-7 h-7 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {isDragging ? "Drop to upload" : "Drag & drop PDF or ePub"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or <span className="text-primary underline-offset-2 hover:underline">browse files</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">PDF, ePub · Max 50 MB</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {isUploading && (
        <div className="border border-border rounded-xl p-5 space-y-3 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm truncate">{localFileInfo?.name}</p>
              <p className="text-xs text-muted-foreground">
                {uploadProgress < 50 ? "Computing SHA-256 hash..." :
                  uploadProgress < 70 ? "Preparing upload..." :
                  uploadProgress < 100 ? "Uploading to S3..." : "Finalizing..."}
              </p>
            </div>
            <span className="text-sm font-mono text-primary">{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      {/* File info card (after upload or existing file) */}
      {!isUploading && displayFile?.fileName && (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
              {displayFile.fileMimeType === "application/pdf"
                ? <FileText className="w-5 h-5 text-green-400" />
                : <File className="w-5 h-5 text-blue-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm truncate">{displayFile.fileName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {displayFile.fileSize ? formatBytes(displayFile.fileSize) : "—"}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground uppercase">
                  {displayFile.fileMimeType === "application/pdf" ? "PDF" : "ePub"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span className="text-xs text-green-400 font-medium">Uploaded</span>
            </div>
          </div>

          {/* SHA-256 Hash */}
          {displayFile.fileHash && (
            <div className="p-4 bg-secondary/30 border-b border-border">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                    SHA-256 File Hash (Real)
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-foreground/80 break-all leading-relaxed">
                      {displayFile.fileHash}
                    </code>
                    <button
                      onClick={() => copyToClipboard(displayFile.fileHash!)}
                      className="flex-shrink-0 p-1 rounded hover:bg-secondary transition-colors"
                      title="Copy hash"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Computed from actual file bytes · Stored on book record · Used for integrity verification
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 p-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2 text-xs"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5" /> Replace File
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => removeMutation.mutate({ bookId })}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Trash2 className="w-3.5 h-3.5" />
              }
              Remove
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.epub"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* No file state */}
      {!isUploading && !hasFile && !displayFile?.fileName && currentFile && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-dashed border-border">
          <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground">No file uploaded yet for <strong className="text-foreground">{bookTitle}</strong></p>
        </div>
      )}
    </div>
  );
}
