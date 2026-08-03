'use client'

import React, { useEffect, useRef, useState } from 'react'
import { FilePdf } from '@phosphor-icons/react'

// pdfjs-dist is heavy and browser-only: lazy-import it once and pin the worker
// to the installed version (same pattern as PdfThumbnail).
let pdfjsPromise: Promise<any> | null = null
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
      return pdfjs
    })
  }
  return pdfjsPromise
}

interface ViewOnlyPdfProps {
  url?: string
  className?: string
}

interface PdfPageProps {
  pdfDoc: any
  pageNumber: number
  width: number
}

/**
 * Renders a single PDF page to a <canvas>, lazily — only once it scrolls near
 * the viewport — so large documents don't render every page up front.
 */
function PdfPage({ pdfDoc, pageNumber, width }: PdfPageProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [status, setStatus] = useState<'pending' | 'done' | 'error'>('pending')

  useEffect(() => {
    let cancelled = false
    let renderTask: any = null
    const el = wrapRef.current
    if (!el) return

    const io = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        if (cancelled) return
        try {
          const page = await pdfDoc.getPage(pageNumber)
          if (cancelled) return
          const canvas = canvasRef.current
          if (!canvas) return
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('no 2d context')

          // Hi-DPI: draw at devicePixelRatio, display at the logical CSS size.
          const base = page.getViewport({ scale: 1 })
          const scale = width / base.width
          const viewport = page.getViewport({ scale })
          const outputScale = window.devicePixelRatio || 1
          canvas.width = Math.floor(viewport.width * outputScale)
          canvas.height = Math.floor(viewport.height * outputScale)
          canvas.style.width = `${Math.floor(viewport.width)}px`
          canvas.style.height = `${Math.floor(viewport.height)}px`
          ctx.scale(outputScale, outputScale)

          renderTask = page.render({ canvasContext: ctx, viewport })
          await renderTask.promise
          if (cancelled) return
          setStatus('done')
        } catch {
          if (!cancelled) setStatus('error')
        }
      },
      { rootMargin: '600px 0px' }
    )
    io.observe(el)

    return () => {
      cancelled = true
      io.disconnect()
      try {
        renderTask?.cancel?.()
      } catch {
        /* best-effort cleanup */
      }
    }
  }, [pdfDoc, pageNumber, width])

  return (
    <div
      ref={wrapRef}
      className="relative w-full bg-white shadow-sm"
      // Page-shaped placeholder until the real height is known (A4-ish ratio).
      style={{ minHeight: status === 'done' ? 0 : Math.max(200, width * 1.414) }}
    >
      {status === 'done' ? null : status === 'error' ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <FilePdf size={40} weight="fill" className="text-zinc-300" />
        </div>
      ) : (
        <div className="absolute inset-0 animate-pulse bg-zinc-100" />
      )}
      <canvas ref={canvasRef} className="block" />
    </div>
  )
}

/**
 * View-only PDF renderer (pdf.js → <canvas>). Replaces the native-browser PDF
 * <iframe> (which exposes Download / Save / Print) so the document can be READ
 * but not downloaded through the reader:
 *  - no native toolbar / Download button
 *  - text selection disabled, right-click "Save image/as" blocked
 *  - hidden from print (print-to-PDF yields a blank page)
 * Pages render lazily as they scroll into view, so large PDFs stay cheap.
 *
 * NOTE: this removes every easy digital-download path from the UI. It cannot
 * stop a determined viewer from screenshotting / capturing the network bytes
 * (inherent to any web content the user is allowed to see). The PDF still has
 * to reach the browser to be rendered.
 */
export default function ViewOnlyPdf({ url, className }: ViewOnlyPdfProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const [doc, setDoc] = useState<any>(null)
  const [numPages, setNumPages] = useState(0)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  const pageWidth = width > 0 ? Math.min(width - 24, 900) : 0

  // Measure available width for crisp, fit-to-width rendering.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    let pdfDoc: any = null
    setState('loading')
    ;(async () => {
      try {
        const pdfjs = await loadPdfjs()
        if (cancelled) return
        // withCredentials so the session cookie reaches the media endpoint
        // (private PDFs are access-checked server-side).
        const loadingTask = pdfjs.getDocument({ url, withCredentials: true })
        pdfDoc = await loadingTask.promise
        if (cancelled) return
        setDoc(pdfDoc)
        setNumPages(pdfDoc.numPages)
        setState('ready')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
      try {
        pdfDoc?.destroy?.()
      } catch {
        /* best-effort */
      }
    }
  }, [url])

  return (
    <div className={className ?? 'w-full h-full'}>
      {/* Hide the document from print so print-to-PDF can't capture it. */}
      <style>{`@media print { .lh-pdf-viewer, .lh-pdf-viewer * { visibility: hidden !important; } }`}</style>
      <div
        ref={scrollRef}
        onContextMenu={(e) => e.preventDefault()}
        className="lh-pdf-viewer select-none h-full w-full overflow-auto bg-zinc-100"
      >
        {state === 'loading' && (
          <div className="flex h-full items-center justify-center text-zinc-500">
            <span className="animate-pulse text-sm">Loading document…</span>
          </div>
        )}
        {state === 'error' && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-500">
            <FilePdf size={48} weight="fill" className="text-zinc-400" />
            <span className="text-sm">This document couldn&apos;t be loaded.</span>
          </div>
        )}
        {state === 'ready' && pageWidth > 0 && doc && (
          <div className="mx-auto flex flex-col items-center gap-3 py-3" style={{ width: pageWidth }}>
            {Array.from({ length: numPages }, (_, i) => (
              <PdfPage key={i} pdfDoc={doc} pageNumber={i + 1} width={pageWidth} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
