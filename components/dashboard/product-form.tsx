'use client';

import { useCallback, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useBusiness } from '@/lib/business-context';
import { Product } from '@/lib/types';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import {
  Barcode, X, Camera, CheckCircle, Loader2, Package,
  Hash, DollarSign, Layers, RotateCcw,
  ChevronDown, Info, Save, AlertCircle, ScanLine, Zap,
  ImagePlus, Trash2, Plus, Tag,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductFormProps {
  product: Product | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const DEFAULT_CATEGORIES = [
  { value: 'home-appliances',          label: 'Home Appliances',   emoji: '🏠' },
  { value: 'sneakers',                  label: 'Sneakers',          emoji: '👟' },
  { value: 'phone-laptop-accessories', label: 'Tech Accessories',  emoji: '💻' },
  { value: 'clothing',                  label: 'Clothing',          emoji: '👔' },
  { value: 'food-beverages',            label: 'Food & Beverages',  emoji: '🍔' },
  { value: 'other',                     label: 'Other',             emoji: '📦' },
];

// ── Cloudinary config ────────────────────────────────────────────────────────
// Add these to your .env.local:
//   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
//   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
const CLOUDINARY_CLOUD_NAME    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) throw new Error(`Cloudinary upload failed: ${await res.text()}`);

  const data = await res.json();
  // Return the secure URL from Cloudinary's response
  return data.secure_url as string;
}

export function ProductForm({ product, onSuccess, onCancel }: ProductFormProps) {
  const { activeBusiness } = useBusiness();
  const isEdit = !!product;

  // ── Custom categories ────────────────────────────────────────────────────
  const [customCategories, setCustomCategories] = useState<{ value: string; label: string; emoji: string }[]>([]);
  const [showCatInput,     setShowCatInput]      = useState(false);
  const [newCatLabel,      setNewCatLabel]        = useState('');
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  const addCustomCategory = () => {
    const label = newCatLabel.trim();
    if (!label) return;
    const value = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (allCategories.find((c) => c.value === value)) return;
    const newCat = { value, label, emoji: '🏷️' };
    setCustomCategories((prev) => [...prev, newCat]);
    set('category', value);
    setNewCatLabel('');
    setShowCatInput(false);
  };

  // ── Form state ───────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name:          product?.name          ?? '',
    brand:         product?.brand         ?? '',
    sku:           product?.sku           ?? '',
    category:      product?.category      ?? '',
    quantity:      product?.quantity      ?? 0,
    openingBoxes:  (product as any)?.openingBoxes  ?? 0,
    loosePieces:   (product as any)?.loosePieces   ?? 0,
    description:   product?.description   ?? '',
    pieceCost:     (product as any)?.pieceCost     ?? 0,
    piecePrice:    (product as any)?.piecePrice    ?? product?.sellingPrice ?? 0,
    boxEnabled:    (product as any)?.boxEnabled    ?? false,
    boxQty:        (product as any)?.boxQty        ?? 12,
    boxCost:       (product as any)?.boxCost       ?? 0,
    boxPrice:      (product as any)?.boxPrice      ?? 0,
    lowStockAlert: product?.lowStockAlert ?? 5,
  });

  const [saving, setSaving]           = useState(false);
  const [saved,  setSaved]            = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');

  // ── Image state ──────────────────────────────────────────────────────────
  const [imageFile,      setImageFile]      = useState<File | null>(null);
  const [imagePreview,   setImagePreview]   = useState<string>(product?.imageUrl ?? '');
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError,     setImageError]     = useState('');

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setImageError('Image must be under 5 MB'); return; }
    if (!file.type.startsWith('image/')) { setImageError('Only image files are allowed'); return; }
    setImageError('');
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const set = useCallback((key: string, val: string | number | boolean) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }, []);

  const updateQuantityFromBoxes = (boxes: number, loose: number, boxQty: number) => {
    set('quantity', boxes * boxQty + loose);
  };

  const handleOpeningBoxes = (val: number) => {
    set('openingBoxes', val);
    updateQuantityFromBoxes(val, form.loosePieces, form.boxQty);
  };

  const handleLoosePieces = (val: number) => {
    set('loosePieces', val);
    updateQuantityFromBoxes(form.openingBoxes, val, form.boxQty);
  };

  const handleBoxQtyChange = (qty: number) => {
    set('boxQty', qty);
    if (form.piecePrice > 0) set('boxPrice', parseFloat((form.piecePrice * qty).toFixed(2)));
    if (form.pieceCost  > 0) set('boxCost',  parseFloat((form.pieceCost  * qty).toFixed(2)));
    if (form.boxEnabled) updateQuantityFromBoxes(form.openingBoxes, form.loosePieces, qty);
  };

  const pieceMargin = form.piecePrice > 0 && form.pieceCost > 0
    ? (form.piecePrice - form.pieceCost).toFixed(2)
    : null;
  const boxMargin = form.boxEnabled && form.boxPrice > 0 && form.boxCost > 0
    ? (form.boxPrice - form.boxCost).toFixed(2)
    : null;

  // ── Scanner ──────────────────────────────────────────────────────────────
  const [scanMsg, setScanMsg] = useState('');
  const [scanOk,  setScanOk]  = useState(false);

  const handleScan = useCallback((code: string) => {
    const normalised = code.trim().toUpperCase();
    set('sku', normalised);
    setScanOk(true);
    setScanMsg(`✓ Scanned: ${normalised}`);
  }, [set]);

  const { scannerState, cameraError, videoRef, startCamera, stopCamera, externalEnabled, setExternalEnabled } =
    useBarcodeScanner({ onScan: handleScan });

  const scanning    = scannerState === 'starting' || scannerState === 'active';
  const cameraReady = scannerState === 'active';

  // ── Validation ───────────────────────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())     e.name       = 'Product name is required';
    if (!form.sku.trim())      e.sku        = 'Barcode / SKU is required';
    if (!form.category)        e.category   = 'Please select a category';
    if (form.piecePrice <= 0)  e.piecePrice = 'Selling price per piece is required';
    if (form.boxEnabled && form.boxQty < 2) e.boxQty = 'Box must contain at least 2 units';
    if (form.boxEnabled && form.boxPrice <= 0) e.boxPrice = 'Box selling price is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!activeBusiness) { setGlobalError('No active business selected.'); return; }
    setSaving(true); setGlobalError('');
    try {
      let imageUrl = product?.imageUrl ?? '';
      if (imageFile) {
        setImageUploading(true);
        try { imageUrl = await uploadToCloudinary(imageFile); }
        catch (err: any) { setGlobalError(`Image upload failed: ${err.message}`); setSaving(false); setImageUploading(false); return; }
        setImageUploading(false);
      }
      const payload = {
        name:          form.name.trim(),
        brand:         form.brand.trim(),
        sku:           form.sku.trim().toUpperCase(),
        category:      form.category,
        quantity:      form.quantity,
        openingBoxes:  form.boxEnabled ? form.openingBoxes : null,
        loosePieces:   form.boxEnabled ? form.loosePieces  : null,
        description:   form.description,
        pieceCost:     form.pieceCost,
        piecePrice:    form.piecePrice,
        sellingPrice:  form.piecePrice,
        costPrice:     form.pieceCost,
        boxEnabled:    form.boxEnabled,
        boxQty:        form.boxEnabled ? form.boxQty   : null,
        boxCost:       form.boxEnabled ? form.boxCost  : null,
        boxPrice:      form.boxEnabled ? form.boxPrice : null,
        lowStockAlert: form.lowStockAlert,
        imageUrl,
        businessId:    activeBusiness.id,
        lastUpdated:   new Date(),
        ...(isEdit ? {} : { dateAdded: new Date() }),
      };
      if (isEdit) await updateDoc(doc(db, 'products', product!.id), payload);
      else        await addDoc(collection(db, 'products'), payload);
      setSaved(true);
      setTimeout(() => onSuccess(), 700);
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Scanner overlay */}
      <AnimatePresence>
        {scanning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }} className="w-full max-w-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <ScanLine className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-sm">Scan Barcode</h3>
                    <p className="text-gray-500 text-xs">Point at any product barcode</p>
                  </div>
                </div>
                <button onClick={stopCamera} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[4/3]">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                {!cameraReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950">
                    <Loader2 className="w-7 h-7 text-green-400 animate-spin mb-2" />
                    <p className="text-gray-400 text-xs">Starting camera…</p>
                  </div>
                )}
                {cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="absolute inset-0 bg-black/25" />
                    <div className="relative z-10 w-4/5 h-28">
                      {['top-0 left-0 border-t-2 border-l-2 rounded-tl-lg','top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
                        'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg','bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
                      ].map((cls, i) => <div key={i} className={`absolute w-7 h-7 border-green-400 ${cls}`} />)}
                      <motion.div className="absolute left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-green-400 to-transparent"
                        animate={{ top: ['8%', '88%', '8%'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
                    </div>
                  </div>
                )}
              </div>
              <p className="text-center text-gray-500 text-xs">Auto-detects — no button needed</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ══ LEFT COLUMN ══ */}
          <div className="lg:col-span-2 space-y-4">

            {/* Scan success banner */}
            <AnimatePresence>
              {scanMsg && scanOk && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-semibold">{scanMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Basic Info ── */}
            <FormCard label="Basic Information" icon={<Package className="w-3.5 h-3.5" />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <FieldLabel label="Product Name" required />
                  <input value={form.name} onChange={(e) => set('name', e.target.value)}
                    placeholder="e.g. Nike Air Max 270" className={inputCls(!!errors.name)} />
                  <FieldError msg={errors.name} />
                </div>
                <div>
                  <FieldLabel label="Brand" />
                  <input value={form.brand} onChange={(e) => set('brand', e.target.value)}
                    placeholder="e.g. Nike" className={inputCls(false)} />
                </div>
                <div>
                  <FieldLabel label="Category" required />
                  <div className="space-y-2">
                    <div className="relative">
                      <select value={form.category} onChange={(e) => set('category', e.target.value)}
                        className={`${inputCls(!!errors.category)} appearance-none pr-9`}>
                        <option value="">Select category…</option>
                        {allCategories.map((c) => (
                          <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    <AnimatePresence>
                      {showCatInput ? (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="flex gap-2">
                            <input
                              value={newCatLabel}
                              onChange={(e) => setNewCatLabel(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomCategory())}
                              placeholder="Category name…"
                              autoFocus
                              className="flex-1 h-9 px-3 rounded-lg border-2 border-green-500/30 bg-green-500/5 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-green-500 transition-colors placeholder:text-gray-400"
                            />
                            <button type="button" onClick={addCustomCategory}
                              className="h-9 px-3 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition-colors flex-shrink-0">
                              Add
                            </button>
                            <button type="button" onClick={() => { setShowCatInput(false); setNewCatLabel(''); }}
                              className="h-9 w-9 rounded-lg border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <button type="button" onClick={() => setShowCatInput(true)}
                          className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400 hover:text-green-700 transition-colors">
                          <Plus className="w-3 h-3" /> Add custom category
                        </button>
                      )}
                    </AnimatePresence>
                    <FieldError msg={errors.category} />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel label="Description" hint="optional" />
                  <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                    placeholder="Specs, notes, or any additional details…" rows={3}
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-green-500 transition-colors resize-none placeholder:text-gray-400" />
                </div>
              </div>
            </FormCard>

            {/* ── Product Image ── */}
            <FormCard label="Product Image" icon={<ImagePlus className="w-3.5 h-3.5" />}>
              <div className="space-y-3">
                <AnimatePresence mode="wait">
                  {imagePreview ? (
                    <motion.div key="preview" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className="relative rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                      <img src={imagePreview} alt="Product preview" className="w-full h-48 object-contain" />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-all group flex items-center justify-center gap-2 flex-wrap p-3">
                        <label className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <input type="file" accept="image/*" capture="environment" onChange={handleImagePick} className="hidden" />
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/90 text-gray-800 text-xs font-bold hover:bg-white transition-colors">
                            <Camera className="w-3.5 h-3.5" /> Camera
                          </div>
                        </label>
                        <label className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <input type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/90 text-gray-800 text-xs font-bold hover:bg-white transition-colors">
                            <ImagePlus className="w-3.5 h-3.5" /> Gallery
                          </div>
                        </label>
                        <button type="button" onClick={() => { setImageFile(null); setImagePreview(''); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/90 text-white text-xs font-bold hover:bg-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                      {imageUploading && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                          <p className="text-white text-xs font-bold">Uploading…</p>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div key="picker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col items-center justify-center gap-2.5 h-32 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:border-green-400 hover:bg-green-500/5 transition-all group">
                        <input type="file" accept="image/*" capture="environment" onChange={handleImagePick} className="hidden" />
                        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 group-hover:bg-green-500/10 flex items-center justify-center transition-colors">
                          <Camera className="w-5 h-5 text-gray-400 group-hover:text-green-500 transition-colors" />
                        </div>
                        <div className="text-center px-2">
                          <p className="text-xs font-bold text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">Take Photo</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Use camera</p>
                        </div>
                      </label>
                      <label className="flex flex-col items-center justify-center gap-2.5 h-32 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:border-blue-400 hover:bg-blue-500/5 transition-all group">
                        <input type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
                        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 group-hover:bg-blue-500/10 flex items-center justify-center transition-colors">
                          <ImagePlus className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                        </div>
                        <div className="text-center px-2">
                          <p className="text-xs font-bold text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">Choose File</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Gallery / files</p>
                        </div>
                      </label>
                    </motion.div>
                  )}
                </AnimatePresence>
                {imageError && <p className="text-xs text-red-500 flex items-center gap-1 font-medium"><AlertCircle className="w-3 h-3" />{imageError}</p>}
                <p className="text-[11px] text-gray-400 flex items-start gap-1.5">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />Stored in Cloudinary. Used on receipts and product cards.
                </p>
              </div>
            </FormCard>

            {/* ── Barcode / SKU ── */}
            <FormCard label="Barcode / SKU" icon={<Barcode className="w-3.5 h-3.5" />}>
              <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 mb-4 transition-colors ${
                externalEnabled ? 'bg-blue-500/5 border-blue-500/20' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex items-center gap-2">
                  <Zap className={`w-3.5 h-3.5 ${externalEnabled ? 'text-blue-500' : 'text-gray-400'}`} />
                  <div>
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300">External Scanner</p>
                    <p className="text-[10px] text-gray-400">USB / Bluetooth HID</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {externalEnabled && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-blue-500">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
                      </span>LISTENING
                    </span>
                  )}
                  <button type="button" onClick={() => setExternalEnabled(!externalEnabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${externalEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${externalEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
              <FieldLabel label="Barcode or SKU Code" required />
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input value={form.sku} onChange={(e) => set('sku', e.target.value.toUpperCase())}
                    placeholder="Scan or type barcode / SKU…"
                    className={`${inputCls(!!errors.sku)} pl-9 font-mono font-bold tracking-widest`} />
                </div>
                <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={scanning ? stopCamera : startCamera}
                  className="flex items-center gap-2 px-4 h-11 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-colors shadow-md shadow-green-500/20 flex-shrink-0">
                  <Camera className="w-4 h-4" /><span className="hidden sm:inline">Scan</span>
                </motion.button>
                <AnimatePresence>
                  {form.sku && (
                    <motion.button type="button" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }} whileTap={{ scale: 0.9 }}
                      onClick={() => { set('sku', ''); setScanMsg(''); setScanOk(false); stopCamera(); }}
                      className="w-11 h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-300 dark:hover:border-red-700 transition-colors flex-shrink-0">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              <FieldError msg={errors.sku} />
              <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                <Info className="w-3 h-3" />Use camera to scan EAN-13, UPC, QR, or Code128
              </p>
            </FormCard>

            {/* ── Pricing ── */}
            <FormCard label="Pricing" icon={<DollarSign className="w-3.5 h-3.5" />}>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <Tag className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">Per Piece <span className="text-red-500">*</span></p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel label="Cost Price (₵)" hint="what you paid" />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">₵</span>
                      <input type="number" min="0" step="0.01" value={form.pieceCost || ''}
                        onChange={(e) => set('pieceCost', parseFloat(e.target.value) || 0)}
                        placeholder="0.00" className={`${inputCls(false)} pl-7`} />
                    </div>
                  </div>
                  <div>
                    <FieldLabel label="Selling Price (₵)" required />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-green-500">₵</span>
                      <input type="number" min="0" step="0.01" value={form.piecePrice || ''}
                        onChange={(e) => set('piecePrice', parseFloat(e.target.value) || 0)}
                        placeholder="0.00" className={`${inputCls(!!errors.piecePrice)} pl-7 font-bold`} />
                    </div>
                    <FieldError msg={errors.piecePrice} />
                  </div>
                </div>
                <AnimatePresence>
                  {pieceMargin !== null && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <MarginPill margin={pieceMargin} label="Piece margin" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="my-4 border-t border-gray-100 dark:border-gray-800" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${form.boxEnabled ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
                      <Package className={`w-3 h-3 ${form.boxEnabled ? 'text-white' : 'text-gray-400'}`} />
                    </div>
                    <p className={`text-xs font-black uppercase tracking-wider transition-colors ${form.boxEnabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>
                      Per Box <span className="text-[10px] font-normal normal-case tracking-normal text-gray-400 ml-1">optional</span>
                    </p>
                  </div>
                  <button type="button" onClick={() => set('boxEnabled', !form.boxEnabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.boxEnabled ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.boxEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <AnimatePresence>
                  {form.boxEnabled && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="space-y-3 pt-1">
                        <div>
                          <FieldLabel label="Units per Box" hint="how many pieces in one box" />
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => handleBoxQtyChange(Math.max(2, form.boxQty - 1))}
                              className="w-10 h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl font-black text-gray-400 hover:text-amber-500 hover:border-amber-300 transition-all flex-shrink-0">−</button>
                            <input type="number" min="2" value={form.boxQty || ''}
                              onChange={(e) => handleBoxQtyChange(parseInt(e.target.value) || 2)}
                              className={`${inputCls(!!errors.boxQty)} text-center font-black text-lg`} />
                            <button type="button" onClick={() => handleBoxQtyChange(form.boxQty + 1)}
                              className="w-10 h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl font-black text-gray-400 hover:text-amber-500 hover:border-amber-300 transition-all flex-shrink-0">+</button>
                          </div>
                          <FieldError msg={errors.boxQty} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <FieldLabel label="Box Cost (₵)" hint="what you paid" />
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">₵</span>
                              <input type="number" min="0" step="0.01" value={form.boxCost || ''}
                                onChange={(e) => set('boxCost', parseFloat(e.target.value) || 0)}
                                placeholder="0.00" className={`${inputCls(false)} pl-7`} />
                            </div>
                          </div>
                          <div>
                            <FieldLabel label="Box Selling Price (₵)" required />
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-500">₵</span>
                              <input type="number" min="0" step="0.01" value={form.boxPrice || ''}
                                onChange={(e) => set('boxPrice', parseFloat(e.target.value) || 0)}
                                placeholder="0.00" className={`${inputCls(!!errors.boxPrice)} pl-7 font-bold`} />
                            </div>
                            <FieldError msg={errors.boxPrice} />
                          </div>
                        </div>

                        {form.piecePrice > 0 && (
                          <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                            <Info className="w-3 h-3 flex-shrink-0" />
                            Suggested box price: <span className="font-bold text-amber-600 dark:text-amber-400">₵{(form.piecePrice * form.boxQty).toFixed(2)}</span> ({form.boxQty} × ₵{form.piecePrice})
                          </p>
                        )}

                        <AnimatePresence>
                          {boxMargin !== null && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                              <MarginPill margin={boxMargin} label="Box margin" color="amber" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FormCard>
          </div>

          {/* ══ RIGHT COLUMN ══ */}
          <div className="space-y-4">
            <FormCard label="Stock Levels" icon={<Layers className="w-3.5 h-3.5" />}>
              <div className="space-y-4">
                {form.boxEnabled && form.boxQty > 1 ? (
                  <div className="space-y-3">
                    <div>
                      <FieldLabel label="Opening Stock — Boxes" hint={`${form.boxQty} pcs each`} />
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => handleOpeningBoxes(Math.max(0, form.openingBoxes - 1))}
                          className="w-10 h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl font-black text-gray-400 hover:text-amber-500 hover:border-amber-300 transition-all flex-shrink-0">−</button>
                        <input type="number" min="0" value={form.openingBoxes || ''}
                          onChange={(e) => handleOpeningBoxes(parseInt(e.target.value) || 0)}
                          className={`${inputCls(false)} text-center font-black text-lg text-amber-600 dark:text-amber-400`} />
                        <button type="button" onClick={() => handleOpeningBoxes(form.openingBoxes + 1)}
                          className="w-10 h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl font-black text-gray-400 hover:text-amber-500 hover:border-amber-300 transition-all flex-shrink-0">+</button>
                      </div>
                    </div>
                    <div>
                      <FieldLabel label="Loose Pieces" hint="extra pieces not in a box" />
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => handleLoosePieces(Math.max(0, form.loosePieces - 1))}
                          className="w-10 h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl font-black text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 transition-all flex-shrink-0">−</button>
                        <input type="number" min="0" value={form.loosePieces || ''}
                          onChange={(e) => handleLoosePieces(parseInt(e.target.value) || 0)}
                          className={`${inputCls(false)} text-center font-black text-lg`} />
                        <button type="button" onClick={() => handleLoosePieces(form.loosePieces + 1)}
                          className="w-10 h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl font-black text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 transition-all flex-shrink-0">+</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Total units in stock</span>
                      <div className="text-right">
                        <span className="text-base font-black text-amber-600 dark:text-amber-400">{form.quantity}</span>
                        <span className="text-xs text-gray-400 ml-1">
                          ({form.openingBoxes} box{form.openingBoxes !== 1 ? 'es' : ''} + {form.loosePieces} pc{form.loosePieces !== 1 ? 's' : ''})
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <FieldLabel label="Opening Stock" hint="units available" />
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => set('quantity', Math.max(0, form.quantity - 1))}
                        className="w-10 h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl font-black text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 transition-all flex-shrink-0">−</button>
                      <input type="number" min="0" value={form.quantity || ''}
                        onChange={(e) => set('quantity', parseInt(e.target.value) || 0)}
                        className={`${inputCls(false)} text-center font-black text-lg`} />
                      <button type="button" onClick={() => set('quantity', form.quantity + 1)}
                        className="w-10 h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl font-black text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 transition-all flex-shrink-0">+</button>
                    </div>
                  </div>
                )}

                <div>
                  <FieldLabel label="Low Stock Alert" hint="notify when below" />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => set('lowStockAlert', Math.max(1, form.lowStockAlert - 1))}
                      className="w-10 h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl font-black text-gray-400 hover:text-yellow-500 hover:border-yellow-300 transition-all flex-shrink-0">−</button>
                    <input type="number" min="1" value={form.lowStockAlert || ''}
                      onChange={(e) => set('lowStockAlert', parseInt(e.target.value) || 1)}
                      className={`${inputCls(false)} text-center font-bold text-yellow-600 dark:text-yellow-400`} />
                    <button type="button" onClick={() => set('lowStockAlert', form.lowStockAlert + 1)}
                      className="w-10 h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl font-black text-gray-400 hover:text-yellow-500 hover:border-yellow-300 transition-all flex-shrink-0">+</button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">Alert when stock drops to {form.lowStockAlert} units</p>
                </div>
              </div>
            </FormCard>

            {activeBusiness && (
              <div className="rounded-2xl border-2 border-green-500/15 bg-green-500/5 p-4 space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-green-500">Saving to</p>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                    {activeBusiness.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{activeBusiness.name}</p>
                    <p className="text-[11px] font-mono text-gray-400">{activeBusiness.businessId}</p>
                  </div>
                </div>
              </div>
            )}

            {(form.name || form.sku || form.piecePrice > 0 || imagePreview) && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
                {imagePreview && <img src={imagePreview} alt="" className="w-full h-32 object-cover" />}
                <div className="p-4 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Preview</p>
                  {form.name && (
                    <div className="flex items-start gap-2">
                      <Package className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{form.name}</span>
                    </div>
                  )}
                  {form.sku && (
                    <div className="flex items-center gap-2">
                      <Barcode className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs font-mono font-bold text-gray-500">{form.sku}</span>
                    </div>
                  )}
                  {form.piecePrice > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                      <span className="text-xs text-gray-400">Per piece</span>
                      <span className="text-base font-black text-green-600 dark:text-green-400">₵{form.piecePrice.toLocaleString()}</span>
                    </div>
                  )}
                  {form.boxEnabled && form.boxPrice > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Per box ({form.boxQty} pcs)</span>
                      <span className="text-sm font-black text-amber-600 dark:text-amber-400">₵{form.boxPrice.toLocaleString()}</span>
                    </div>
                  )}
                  {form.quantity > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Stock</span>
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{form.quantity} units</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {globalError && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-4">
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{globalError}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
          <button type="button" onClick={onCancel}
            className="sm:w-36 h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 font-bold text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 transition-all">
            Cancel
          </button>
          <motion.button type="submit" disabled={saving || saved} whileTap={{ scale: 0.97 }}
            className="flex-1 h-11 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-500/20">
            {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</>
              : saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {imageUploading ? 'Uploading…' : 'Saving…'}</>
              : <><Save className="w-4 h-4" /> {isEdit ? 'Update Product' : 'Add to Inventory'}</>}
          </motion.button>
        </div>
      </form>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function MarginPill({ margin, label, color = 'green' }: { margin: string; label: string; color?: 'green' | 'amber' }) {
  const val = parseFloat(margin);
  const cls = val > 0
    ? color === 'amber' ? 'bg-amber-500/8 border-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-green-500/8 border-green-500/15 text-green-600 dark:text-green-400'
    : val === 0 ? 'bg-yellow-500/8 border-yellow-500/15 text-yellow-600 dark:text-yellow-400'
                : 'bg-red-500/8 border-red-500/15 text-red-600 dark:text-red-400';
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold border ${cls}`}>
      <span>{label}</span>
      <span className="font-black text-lg">₵{Math.abs(val).toLocaleString('en-GH', { minimumFractionDigits: 2 })}{val < 0 ? ' loss' : ' profit'}</span>
    </div>
  );
}

const inputCls = (hasError: boolean) =>
  `w-full h-11 px-3.5 rounded-xl border-2 text-sm font-medium focus:outline-none transition-colors placeholder:text-gray-400 ${
    hasError
      ? 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/10 text-gray-900 dark:text-white focus:border-red-500'
      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-green-500'
  }`;

function FormCard({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-gray-50 dark:bg-gray-900/80 border-b border-gray-100 dark:border-gray-800">
        <span className="text-green-500">{icon}</span>
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldLabel({ label, required, hint }: { label: string; required?: boolean; hint?: string }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
      {label}
      {required && <span className="text-red-500 text-base leading-none">*</span>}
      {hint && <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-gray-400">{hint}</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="text-xs text-red-500 mt-1 flex items-center gap-1 font-medium">
          <AlertCircle className="w-3 h-3" />{msg}
        </motion.p>
      )}
    </AnimatePresence>
  );
}