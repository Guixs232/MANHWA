/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  Upload, 
  Languages, 
  Image as ImageIcon, 
  Loader2, 
  Download, 
  ExternalLink,
  Smartphone,
  Monitor,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  History,
  X,
  Globe,
  Settings,
  Zap,
  LayoutGrid,
  BookOpen,
  Info,
  Github
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translateManhwaPage, TranslationBox } from './services/geminiService';

interface HistoryItem {
  id: string;
  originalImage: string;
  boxes: TranslationBox[];
  timestamp: number;
  targetLang: string;
}

function ComparisonSlider({ original, translated }: { original: string, translated: string }) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const position = ((x - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(Math.max(position, 0), 100));
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full max-w-2xl aspect-auto overflow-hidden rounded-xl shadow-2xl cursor-col-resize select-none"
      onMouseMove={(e) => e.buttons === 1 && handleMove(e)}
      onTouchMove={handleMove}
    >
      <img src={translated} alt="Translated" className="w-full h-auto block" referrerPolicy="no-referrer" />
      <div 
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPos}%` }}
      >
        <img src={original} alt="Original" className="w-full h-auto block max-w-none" style={{ width: containerRef.current?.clientWidth }} referrerPolicy="no-referrer" />
      </div>
      <div 
        className="absolute inset-y-0 w-1 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] z-10"
        style={{ left: `${sliderPos}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
          <div className="flex gap-0.5">
            <div className="w-0.5 h-3 bg-white/50 rounded-full" />
            <div className="w-0.5 h-3 bg-white/50 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TranslatedPage({ page, viewMode }: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = page.url;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      if (viewMode !== 'original' && page.boxes.length > 0) {
        page.boxes.forEach(box => {
          const { ymin, xmin, ymax, xmax } = box.boundingBox;
          const x = (xmin / 1000) * canvas.width;
          const y = (ymin / 1000) * canvas.height;
          const w = ((xmax - xmin) / 1000) * canvas.width;
          const h = ((ymax - ymin) / 1000) * canvas.height;

          ctx.fillStyle = box.backgroundColor || '#FFFFFF';
          ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

          ctx.fillStyle = box.textColor || '#000000';
          const fontSize = box.fontSize || (h * 0.2);
          ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const wrapText = (context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
            const words = text.split(' ');
            let line = '';
            const lines = [];

            for (let n = 0; n < words.length; n++) {
              const testLine = line + words[n] + ' ';
              const metrics = context.measureText(testLine);
              const testWidth = metrics.width;
              if (testWidth > maxWidth && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
              } else {
                line = testLine;
              }
            }
            lines.push(line);

            const startY = y - (lines.length - 1) * lineHeight / 2;
            for (let k = 0; k < lines.length; k++) {
              context.fillText(lines[k], x, startY + k * lineHeight);
            }
          };

          wrapText(ctx, box.translatedText, x + w / 2, y + h / 2, w * 0.9, fontSize * 1.2);
        });
      }
    };
  }, [page, viewMode]);

  return (
    <div className="w-full flex justify-center bg-zinc-900/20 py-2">
      <canvas ref={canvasRef} className="max-w-full h-auto shadow-2xl" />
    </div>
  );
};

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [boxes, setBoxes] = useState<TranslationBox[]>([]);
  const [targetLang, setTargetLang] = useState('Portuguese');
  const [viewMode, setViewMode] = useState<'original' | 'translated' | 'side-by-side'>('translated');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'reader'>('editor');
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [extractedImages, setExtractedImages] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [translatedPages, setTranslatedPages] = useState<{ url: string, boxes: TranslationBox[], id: string }[]>([]);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [translatedImageUrl, setTranslatedImageUrl] = useState<string | null>(null);
  const [customSelector, setCustomSelector] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [supportedSites, setSupportedSites] = useState<{name: string, url: string, selector?: string}[]>([
    { name: 'Webtoons', url: 'webtoons.com' },
    { name: 'MangaDex', url: 'mangadex.org' },
    { name: 'Generic', url: '*', selector: 'img' }
  ]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('manhwa-ai-history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('manhwa-ai-history', JSON.stringify(history));
  }, [history]);

  const addToHistory = (original: string, boxes: TranslationBox[]) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      originalImage: original,
      boxes: boxes,
      timestamp: Date.now(),
      targetLang: targetLang
    };
    setHistory(prev => [newItem, ...prev].slice(0, 20)); // Keep last 20
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const loadFromHistory = (item: HistoryItem) => {
    setImage(item.originalImage);
    setBoxes(item.boxes);
    setTargetLang(item.targetLang);
    setViewMode('translated');
    setActiveTab('preview');
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrlInput) return;
    
    // Check if it's likely a direct image link or a page link
    const isDirectImage = /\.(jpg|jpeg|png|webp|avif|gif)(\?.*)?$/i.test(imageUrlInput);
    
    if (isDirectImage) {
      fetchDirectImage(imageUrlInput);
    } else {
      extractImagesFromPage(imageUrlInput);
    }
  };

  const addCustomSite = () => {
    if (!imageUrlInput || !customSelector) return;
    try {
      const url = new URL(imageUrlInput);
      const newSite = { name: url.hostname, url: url.hostname, selector: customSelector };
      setSupportedSites(prev => [...prev, newSite]);
      setShowAdvanced(false);
    } catch (e) {
      console.error("Invalid URL for custom site");
    }
  };

  const fetchDirectImage = async (url: string) => {
    setIsFetchingUrl(true);
    setIsImageLoading(true);
    try {
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
      const response = await axios.get(proxyUrl, { responseType: 'blob' });
      
      const blob = response.data;
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
        setBoxes([]);
        setImageUrlInput('');
        setExtractedImages([]);
        setActiveTab('preview');
      };
      reader.readAsDataURL(blob);
    } catch (error: any) {
      console.error(error);
      alert(`Erro: ${error.message}. Certifique-se de que o link é uma imagem direta.`);
      setIsImageLoading(false);
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const extractImagesFromPage = async (url: string) => {
    setIsExtracting(true);
    try {
      const response = await axios.get(`/api/extract-images?url=${encodeURIComponent(url)}${customSelector ? `&selector=${encodeURIComponent(customSelector)}` : ''}`);
      const foundImages = response.data.images;
      
      if (foundImages && foundImages.length > 0) {
        setExtractedImages(foundImages);
        setActiveTab('preview');
      } else {
        // Fallback to direct fetch if no images found via extraction
        fetchDirectImage(url);
      }
    } catch (error: any) {
      console.error(error);
      // Fallback to direct fetch
      fetchDirectImage(url);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsImageLoading(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
        setBoxes([]);
        setActiveTab('preview');
      };
      reader.readAsDataURL(file);
    }
  };

  const startTranslation = async () => {
    if (!image) return;
    setIsTranslating(true);
    try {
      const result = await translateManhwaPage(image, targetLang);
      setBoxes(result);
      setViewMode('translated');
      addToHistory(image, result);
      
      // Track single translation in translatedPages for scroll view
      const pageId = Date.now().toString();
      setTranslatedPages([{ url: image, boxes: result, id: pageId }]);
      setActiveTab('reader');
    } catch (error) {
      console.error(error);
      alert("Erro na tradução. Verifique sua chave API.");
    } finally {
      setIsTranslating(false);
    }
  };

  const translateAll = async () => {
    if (extractedImages.length === 0) return;
    
    setIsTranslatingAll(true);
    setTranslationProgress({ current: 0, total: extractedImages.length });
    const results: { url: string, boxes: TranslationBox[], id: string }[] = [];
    
    try {
      for (let i = 0; i < extractedImages.length; i++) {
        setTranslationProgress({ current: i + 1, total: extractedImages.length });
        const imgUrl = extractedImages[i];
        
        // Fetch image as base64 first
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imgUrl)}`;
        const response = await axios.get(proxyUrl, { responseType: 'blob' });
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(response.data);
        });

        const result = await translateManhwaPage(base64, targetLang);
        results.push({ url: base64, boxes: result, id: `page-${i}` });
        addToHistory(base64, result);
        
        // Update UI incrementally
        if (i % 2 === 0 || i === extractedImages.length - 1) {
          setTranslatedPages([...results]);
        }
      }
      setImage(results[0].url); // Set first image as active for single view
      setBoxes(results[0].boxes);
      setActiveTab('reader');
    } catch (error) {
      console.error("Error translating all:", error);
      alert("Ocorreu um erro ao traduzir todas as páginas. Algumas podem ter sido ignoradas.");
    } finally {
      setIsTranslatingAll(false);
    }
  };

  useEffect(() => {
    if (image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = image;
      
      img.onload = () => {
        setIsImageLoading(false);
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw original
        ctx.drawImage(img, 0, 0);

        // Draw original on the side-by-side original canvas if it exists
        if (originalCanvasRef.current) {
          const oCanvas = originalCanvasRef.current;
          const oCtx = oCanvas.getContext('2d');
          if (oCtx) {
            oCanvas.width = img.width;
            oCanvas.height = img.height;
            oCtx.drawImage(img, 0, 0);
            
            // Highlight OCR areas on original if boxes exist
            if (boxes.length > 0) {
              boxes.forEach(box => {
                const { ymin, xmin, ymax, xmax } = box.boundingBox;
                const x = (xmin / 1000) * oCanvas.width;
                const y = (ymin / 1000) * oCanvas.height;
                const w = ((xmax - xmin) / 1000) * oCanvas.width;
                const h = ((ymax - ymin) / 1000) * oCanvas.height;
                
                oCtx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
                oCtx.lineWidth = 2;
                oCtx.strokeRect(x, y, w, h);
                oCtx.fillStyle = 'rgba(16, 185, 129, 0.1)';
                oCtx.fillRect(x, y, w, h);
              });
            }
          }
        }

        if (viewMode !== 'original' && boxes.length > 0) {
          boxes.forEach(box => {
            const { ymin, xmin, ymax, xmax } = box.boundingBox;
            const x = (xmin / 1000) * canvas.width;
            const y = (ymin / 1000) * canvas.height;
            const w = ((xmax - xmin) / 1000) * canvas.width;
            const h = ((ymax - ymin) / 1000) * canvas.height;

            // 1. Erase original (Inpaint-lite)
            ctx.fillStyle = box.backgroundColor || '#FFFFFF';
            // Add a small padding to the erase box
            ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

            // 2. Draw translated text
            ctx.fillStyle = box.textColor || '#000000';
            const fontSize = box.fontSize || (h * 0.2);
            ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Wrap text
            wrapText(ctx, box.translatedText, x + w / 2, y + h / 2, w * 0.9, fontSize * 1.2);
          });
        }

        // Update translatedImageUrl for the slider
        if (viewMode !== 'original') {
          setTranslatedImageUrl(canvas.toDataURL());
        }
      };

      img.onerror = () => {
        setIsImageLoading(false);
        console.error("Failed to load image into canvas");
      };
    }
  }, [image, boxes, viewMode]);

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ');
    let line = '';
    const lines = [];

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    const totalHeight = lines.length * lineHeight;
    let startY = y - (totalHeight / 2) + (lineHeight / 2);

    for (let k = 0; k < lines.length; k++) {
      ctx.fillText(lines[k], x, startY);
      startY += lineHeight;
    }
  };

  const downloadResult = () => {
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.download = `manhwa-translated-${Date.now()}.png`;
      link.href = canvasRef.current.toDataURL();
      link.click();
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Professional & Modern */}
      <header className="h-16 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl flex items-center justify-between px-4 lg:px-8 z-30 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-display font-bold tracking-tight">Manhwa<span className="text-emerald-500">AI</span></h1>
          </div>
          
          <div className="hidden lg:flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">IA Ativa</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <p className="text-xs text-zinc-500 font-medium">Tradução de Alta Precisão</p>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5">
            <select 
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-transparent text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-3 py-1 outline-none cursor-pointer hover:text-white transition-colors"
            >
              <option value="Portuguese">PT-BR</option>
              <option value="English">EN-US</option>
              <option value="Spanish">ES-ES</option>
              <option value="Japanese">JA-JP</option>
              <option value="Korean">KO-KR</option>
            </select>
          </div>

          <div className="h-8 w-px bg-white/10 mx-1" />

          <button className="p-2 text-zinc-400 hover:text-white transition-colors">
            <Info size={18} />
          </button>
          
          <button className="hidden sm:flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 px-4 py-2 rounded-xl transition-all group">
            <Github size={16} className="text-zinc-400 group-hover:text-white" />
            <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white uppercase tracking-widest">Github</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-80 flex-col border-r border-white/5 bg-[#0a0a0a]/80 backdrop-blur-2xl z-20">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold tracking-tight">Manhwa<span className="text-emerald-500">AI</span></h1>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">Translator Pro</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          {/* Main Actions */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <Globe size={14} />
              <span className="text-[11px] font-bold uppercase tracking-wider">Extração de Conteúdo</span>
            </div>
            
            <div className="space-y-3">
              <div className="relative">
                <input 
                  type="url" 
                  placeholder="Cole o link do capítulo..."
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                />
                <button 
                  onClick={handleUrlSubmit}
                  disabled={isFetchingUrl || isExtracting || !imageUrlInput}
                  className="absolute right-2 top-2 p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  {isFetchingUrl || isExtracting ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
                </button>
              </div>

              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${showAdvanced ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'}`}
              >
                <div className="flex items-center gap-2">
                  <Settings size={14} />
                  <span className="text-xs font-medium">Suporte Personalizado</span>
                </div>
                <ChevronRight size={14} className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3 mt-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase">Seletor CSS</label>
                        <input 
                          type="text" 
                          placeholder=".reader-img, #chapter-images img"
                          value={customSelector}
                          onChange={(e) => setCustomSelector(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>
                      <button 
                        onClick={addCustomSite}
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold py-2 rounded-lg transition-colors"
                      >
                        SALVAR CONFIGURAÇÃO
                      </button>
                      <p className="text-[9px] text-zinc-500 italic">
                        Use para sites não suportados nativamente.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Supported Sites */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <Zap size={14} />
              <span className="text-[11px] font-bold uppercase tracking-wider">Sites Suportados</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {supportedSites.map((site) => (
                <div key={site.name} className="p-3 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-1 hover:bg-white/10 transition-colors cursor-default">
                  <span className="text-[10px] font-bold text-white truncate">{site.name}</span>
                  <span className="text-[8px] text-zinc-500 uppercase tracking-tighter">{site.url === '*' ? 'Genérico' : 'Nativo'}</span>
                </div>
              ))}
            </div>
          </section>

          {/* History Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <div className="flex items-center gap-2">
                <History size={14} />
                <span className="text-[11px] font-bold uppercase tracking-wider">Histórico Recente</span>
              </div>
              <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full">{history.length}</span>
            </div>
            
            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="p-8 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                  <p className="text-[10px] text-zinc-500">Nenhuma tradução salva</p>
                </div>
              ) : (
                history.map((item) => (
                  <div 
                    key={item.id}
                    className="group relative bg-white/5 rounded-2xl border border-white/5 p-2 hover:bg-white/10 transition-all cursor-pointer overflow-hidden"
                    onClick={() => loadFromHistory(item)}
                  >
                    <div className="flex gap-3 items-center">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-black flex-shrink-0">
                        <img src={item.originalImage} alt="" className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-white truncate">Tradução #{item.id.slice(-4)}</p>
                        <p className="text-[8px] text-zinc-500">{new Date(item.timestamp).toLocaleDateString()}</p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id, e); }}
                        className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-white/5 bg-black/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sistema Online</span>
            </div>
            <span className="text-[10px] text-zinc-600">v2.4.0</span>
          </div>
        </div>
      </aside>

        {/* Main Content / Preview - Hidden on mobile unless activeTab is preview or reader */}
        <section className={`${activeTab !== 'editor' ? 'flex' : 'hidden'} lg:flex flex-1 bg-black/40 relative overflow-hidden items-center justify-center p-2 lg:p-8`}>
          <AnimatePresence mode="wait">
            {activeTab === 'reader' && translatedPages.length > 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full flex flex-col max-w-4xl mx-auto"
              >
                <div className="mb-6 flex items-center justify-between px-4">
                  <div className="flex flex-col">
                    <h3 className="text-2xl font-display font-bold tracking-tight">Leitor Imersivo</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{translatedPages.length} Páginas Carregadas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-white/5">
                      <button 
                        onClick={() => setViewMode('overlay')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewMode === 'overlay' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        SOBREPOSIÇÃO
                      </button>
                      <button 
                        onClick={() => setViewMode('side-by-side')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewMode === 'side-by-side' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        LADO A LADO
                      </button>
                    </div>
                    <button 
                      onClick={() => setActiveTab('preview')}
                      className="p-2.5 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-xl border border-white/5 transition-colors"
                    >
                      <LayoutGrid size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/40 rounded-3xl border border-white/5 p-2 lg:p-6 flex flex-col gap-4">
                  {translatedPages.map((page) => (
                    <TranslatedPage key={page.id} page={page} viewMode={viewMode} />
                  ))}
                  <div className="py-32 text-center space-y-4">
                    <div className="w-px h-12 bg-gradient-to-b from-emerald-500/50 to-transparent mx-auto" />
                    <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.3em]">Fim do Capítulo</p>
                  </div>
                </div>
              </motion.div>
            ) : extractedImages.length > 0 && !image ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full flex flex-col max-w-6xl mx-auto"
              >
                <div className="mb-8 flex items-center justify-between px-4">
                  <div className="flex flex-col">
                    <h3 className="text-3xl font-display font-bold tracking-tight">Galeria do Capítulo</h3>
                    <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{extractedImages.length} Páginas Detectadas</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      disabled={isTranslatingAll}
                      onClick={translateAll}
                      className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-xl shadow-emerald-500/20"
                    >
                      {isTranslatingAll ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      TRADUZIR CAPÍTULO COMPLETO
                    </button>
                    <button 
                      onClick={() => setExtractedImages([])}
                      className="bg-white/5 hover:bg-white/10 text-zinc-400 text-xs font-bold px-6 py-3 rounded-2xl border border-white/5 transition-all"
                    >
                      VOLTAR
                    </button>
                  </div>
                </div>

                {isTranslatingAll && (
                  <div className="mb-8 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-6 backdrop-blur-xl">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-1">Processamento em Lote</p>
                        <h4 className="text-lg font-bold">Traduzindo páginas...</h4>
                      </div>
                      <span className="text-2xl font-display font-bold text-emerald-500">{Math.round((translationProgress.current / translationProgress.total) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${(translationProgress.current / translationProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-3 text-center uppercase tracking-widest font-bold">Página {translationProgress.current} de {translationProgress.total}</p>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-20 pr-4 custom-scrollbar">
                  {extractedImages.map((imgUrl, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => fetchDirectImage(imgUrl)}
                      className="aspect-[2/3] bg-zinc-900/50 rounded-2xl overflow-hidden cursor-pointer hover:ring-4 hover:ring-emerald-500/30 transition-all group relative border border-white/5"
                    >
                      <img 
                        src={`/api/proxy-image?url=${encodeURIComponent(imgUrl)}`} 
                        alt={`Page ${idx + 1}`}
                        className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                        <div className="bg-emerald-500 text-white text-[10px] font-bold px-4 py-2 rounded-xl shadow-xl">SELECIONAR</div>
                      </div>
                      <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        <span className="bg-white/10 backdrop-blur-md border border-white/10 px-2 py-1 rounded-lg text-[10px] font-bold">#{idx + 1}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : translatedPages.length > 1 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto"
              >
                <div className="relative mb-8">
                  <div className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center animate-pulse" />
                  <Languages className="text-emerald-500 absolute inset-0 m-auto w-10 h-10" />
                </div>
                <h3 className="text-4xl font-display font-bold tracking-tight mb-4">Capítulo Pronto</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-10">A tradução inteligente foi concluída com sucesso. Todas as páginas foram processadas e estão otimizadas para leitura.</p>
                <div className="flex flex-col w-full gap-3">
                  <button 
                    onClick={() => setActiveTab('reader')}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-2xl font-bold transition-all shadow-2xl shadow-emerald-500/30 flex items-center justify-center gap-2"
                  >
                    <BookOpen size={18} />
                    ABRIR NO LEITOR IMERSIVO
                  </button>
                  <button 
                    onClick={() => setTranslatedPages([])}
                    className="w-full bg-white/5 hover:bg-white/10 text-zinc-400 py-4 rounded-2xl font-bold transition-all border border-white/5"
                  >
                    LIMPAR E VOLTAR
                  </button>
                </div>
              </motion.div>
            ) : !image ? (
              <motion.div 
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center max-w-xl px-8"
              >
                <div className="relative w-32 h-32 mx-auto mb-10">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-[3rem] blur-3xl animate-pulse" />
                  <div className="relative w-full h-full bg-zinc-900/80 border border-white/10 rounded-[3rem] flex items-center justify-center backdrop-blur-xl">
                    <ImageIcon className="text-emerald-500 w-12 h-12" />
                  </div>
                </div>
                <h2 className="text-5xl font-display font-bold tracking-tighter mb-6 leading-tight">Traduza seus <span className="text-emerald-500">Manhwas</span> favoritos.</h2>
                <p className="text-zinc-400 text-base leading-relaxed mb-10">
                  Nossa IA avançada detecta e traduz textos em imagens com precisão profissional, preservando a arte original.
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-2xl shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <Upload size={18} />
                    UPLOAD DE IMAGEM
                  </button>
                  <div className="text-zinc-600 font-bold text-xs uppercase tracking-widest">OU</div>
                  <div className="text-zinc-400 text-sm font-medium">COLE UM LINK NO LADO</div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative w-full h-full flex flex-col items-center"
              >
                <div className="w-full max-w-5xl mb-6 flex items-center justify-between px-4">
                  <button 
                    onClick={() => { setImage(null); setBoxes([]); }}
                    className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group"
                  >
                    <div className="p-2 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors">
                      <ChevronLeft size={18} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest">Voltar</span>
                  </button>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-white/5">
                      <button 
                        onClick={() => setViewMode('overlay')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all ${viewMode === 'overlay' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        OVERLAY
                      </button>
                      <button 
                        onClick={() => setViewMode('side-by-side')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all ${viewMode === 'side-by-side' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        COMPARAR
                      </button>
                    </div>
                    <button 
                      disabled={isTranslating}
                      onClick={startTranslation}
                      className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all"
                    >
                      {isTranslating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {isTranslating ? 'TRADUZINDO...' : 'TRADUZIR'}
                    </button>
                  </div>
                </div>

                <div className="flex-1 w-full overflow-hidden flex items-center justify-center p-4">
                  <div className={`relative max-h-full overflow-auto custom-scrollbar rounded-3xl border border-white/10 bg-black/40 shadow-2xl ${viewMode === 'side-by-side' ? 'w-full' : ''}`}>
                    {isImageLoading && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-30 gap-4">
                        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                        <p className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest">Processando Imagem...</p>
                      </div>
                    )}

                  {viewMode === 'side-by-side' && image && translatedImageUrl ? (
                    <ComparisonSlider original={image} translated={translatedImageUrl} />
                  ) : (
                    <>
                      {viewMode === 'side-by-side' && (
                        <div className="relative flex-1 min-w-[300px]">
                          <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest z-10">Original</div>
                          <canvas 
                            ref={originalCanvasRef} 
                            className="max-w-full h-auto block shadow-2xl mx-auto"
                          />
                        </div>
                      )}
                      
                      <div className="relative flex-1 min-w-[300px]">
                        {viewMode === 'side-by-side' && (
                          <div className="absolute top-4 left-4 bg-emerald-500/80 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest z-10">Traduzido</div>
                        )}
                        <canvas 
                          ref={canvasRef} 
                          className="max-w-full h-auto block shadow-2xl mx-auto"
                        />
                      </div>
                    </>
                  )}
                  
                  {isTranslating && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-40">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                      <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500 animate-pulse" />
                    </div>
                    <div className="text-center px-4">
                      <p className="font-bold text-lg">IA Processando...</p>
                      <p className="text-xs text-zinc-400 mt-1">Detectando texto e traduzindo</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Links Overlay - Hidden on mobile */}
          <div className="absolute bottom-6 right-6 hidden lg:flex flex-col gap-2">
            <div className="glass p-4 rounded-2xl flex flex-col gap-3 shadow-2xl">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Fontes Recomendadas</p>
              <a href="https://www.webtoons.com/en/" target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 group">
                <span className="text-sm font-medium group-hover:text-emerald-400 transition-colors">Webtoons</span>
                <ChevronRight size={14} className="text-zinc-600 group-hover:text-emerald-400" />
              </a>
              <div className="h-px bg-white/5" />
              <a href="https://mangadex.org/" target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 group">
                <span className="text-sm font-medium group-hover:text-emerald-400 transition-colors">MangaDex</span>
                <ChevronRight size={14} className="text-zinc-600 group-hover:text-emerald-400" />
              </a>
            </div>
          </div>
        </section>

        {/* Mobile Navigation Tabs */}
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm h-16 bg-zinc-900/90 border border-white/10 flex items-center justify-around px-4 z-50 backdrop-blur-2xl rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <button 
            onClick={() => setActiveTab('editor')}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${activeTab === 'editor' ? 'text-emerald-400 scale-110' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Settings size={20} />
            <span className="text-[8px] font-bold uppercase tracking-widest">Config</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('preview')}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${activeTab === 'preview' ? 'text-emerald-400 scale-110' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <LayoutGrid size={20} />
            <span className="text-[8px] font-bold uppercase tracking-widest">Galeria</span>
          </button>

          <div className="relative flex-1 flex items-center justify-center">
            <button 
              disabled={!image || isTranslating}
              onClick={startTranslation}
              className="absolute -top-10 w-14 h-14 bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-500/40 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:bg-zinc-800 disabled:shadow-none"
            >
              {isTranslating ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
            </button>
          </div>

          {translatedPages.length > 0 && (
            <button 
              onClick={() => setActiveTab('reader')}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${activeTab === 'reader' ? 'text-emerald-400 scale-110' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <BookOpen size={20} />
              <span className="text-[8px] font-bold uppercase tracking-widest">Leitor</span>
            </button>
          )}

          <button 
            onClick={() => {
              setActiveTab('editor');
              setTimeout(() => {
                const historyEl = document.getElementById('mobile-history');
                historyEl?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${history.length > 0 ? 'text-zinc-400' : 'text-zinc-700'}`}
          >
            <History size={20} />
            <span className="text-[8px] font-bold uppercase tracking-widest">Histórico</span>
          </button>
        </div>
      </main>
    </div>
  );
}
