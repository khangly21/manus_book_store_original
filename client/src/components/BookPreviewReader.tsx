/**
 * BookPreviewReader
 *
 * Renders the first N pages of a PDF using react-pdf inside a modal dialog.
 * The preview URL is a short-TTL presigned S3 URL fetched from the backend.
 * Page limit is enforced client-side: once the user reaches the last preview
 * page, a "Buy to Read More" CTA replaces the next-page button.
 */

import { useState, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  BookOpen,
  Loader2,
  AlertCircle,
  ShoppingCart,
  Lock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

// Configure the PDF.js worker — use CDN for the matching version
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookPreviewReaderProps {
  bookId: number;
  bookTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onBuyNow?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookPreviewReader({
  bookId,
  bookTitle,
  isOpen,
  onClose,
  onBuyNow,
}: BookPreviewReaderProps) {
  const [, navigate] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Fetch the short-TTL presigned URL from the backend
  const { data: previewData, isLoading: urlLoading, error: urlError } = trpc.books.previewUrl.useQuery(
    { bookId },
    { enabled: isOpen, staleTime: 10 * 60 * 1000 } // cache for 10 min
  );

  const previewPageLimit = previewData?.previewPageLimit ?? 10;
  const effectiveMaxPage = totalPages
    ? Math.min(previewPageLimit, totalPages)
    : previewPageLimit;

  const isLastPreviewPage = currentPage >= effectiveMaxPage;
  const isFirstPage = currentPage === 1;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
      setTotalPages(null);
      setPdfError(null);
      setScale(1.0);
    }
  }, [isOpen]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setTotalPages(numPages);
    setPdfError(null);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error("[BookPreviewReader] PDF load error:", error);
    setPdfError("Failed to load the preview. Please try again.");
  }, []);

  const goToPrevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goToNextPage = () => setCurrentPage((p) => Math.min(effectiveMaxPage, p + 1));
  const zoomIn = () => setScale((s) => Math.min(2.0, +(s + 0.2).toFixed(1)));
  const zoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)));

  const handleBuyNow = () => {
    onClose();
    if (onBuyNow) {
      onBuyNow();
    } else {
      navigate(`/book/${bookId}`);
    }
  };

  // ─── Render helpers ──────────────────────────────────────────────────────────

  const renderToolbar = () => (
    <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#0a1628]/80 backdrop-blur-sm">
      {/* Left: page navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrevPage}
          disabled={isFirstPage}
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-white/80 min-w-[80px] text-center">
          Page {currentPage} / {effectiveMaxPage}
          {totalPages && totalPages > previewPageLimit && (
            <span className="text-amber-400 ml-1">(preview)</span>
          )}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextPage}
          disabled={isLastPreviewPage}
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Center: title */}
      <div className="hidden sm:flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-medium text-white/90 truncate max-w-[200px]">{bookTitle}</span>
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
          Free Sample
        </Badge>
      </div>

      {/* Right: zoom controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={zoomOut}
          disabled={scale <= 0.5}
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs text-white/60 w-10 text-center">{Math.round(scale * 100)}%</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={zoomIn}
          disabled={scale >= 2.0}
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 ml-1"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderBuyMoreCTA = () => (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-gradient-to-b from-transparent to-[#0a1628]/90">
      <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4 border border-amber-500/30">
        <Lock className="h-8 w-8 text-amber-400" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">End of Free Sample</h3>
      <p className="text-white/60 text-sm mb-6 max-w-xs">
        You've read the first {previewPageLimit} pages.
        {totalPages && ` This book has ${totalPages} pages in total.`} Purchase the full book to continue reading.
      </p>
      <Button
        onClick={handleBuyNow}
        className="bg-amber-500 hover:bg-amber-400 text-[#0a1628] font-bold px-8 py-3 rounded-xl"
      >
        <ShoppingCart className="h-4 w-4 mr-2" />
        Buy Full Book
      </Button>
    </div>
  );

  const renderPdfContent = () => {
    if (urlLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
          <p className="text-white/60 text-sm">Loading preview...</p>
        </div>
      );
    }

    if (urlError || !previewData?.previewUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 px-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-white/80 font-medium">Preview Unavailable</p>
          <p className="text-white/50 text-sm">
            {urlError?.message || "No preview file has been uploaded for this book yet."}
          </p>
        </div>
      );
    }

    if (pdfError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 px-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-white/80 font-medium">Failed to Load PDF</p>
          <p className="text-white/50 text-sm">{pdfError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPdfError(null)}
            className="border-white/20 text-white/70 hover:bg-white/10"
          >
            Retry
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center">
        <Document
          file={previewData.previewUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
              <p className="text-white/60 text-sm">Rendering PDF...</p>
            </div>
          }
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            loading={
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 text-amber-400 animate-spin" />
              </div>
            }
            className="shadow-2xl rounded-lg overflow-hidden"
          />
        </Document>

        {/* Show CTA when on the last preview page */}
        {isLastPreviewPage && totalPages && totalPages > previewPageLimit && renderBuyMoreCTA()}
      </div>
    );
  };

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={`
          bg-[#0d1f3c] border border-white/10 text-white p-0 overflow-hidden
          ${isFullscreen
            ? "max-w-[98vw] w-[98vw] h-[96vh] max-h-[96vh]"
            : "max-w-3xl w-full max-h-[90vh]"
          }
        `}
        style={{ transition: "max-width 0.3s ease, height 0.3s ease" }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Book Preview: {bookTitle}</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        {renderToolbar()}

        {/* PDF Viewport */}
        <div
          className="overflow-auto bg-[#060f1e]"
          style={{ maxHeight: isFullscreen ? "calc(96vh - 56px)" : "calc(90vh - 56px)" }}
        >
          <div className="flex flex-col items-center py-6 px-4 min-h-full">
            {renderPdfContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
