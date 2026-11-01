'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useBusiness } from '@/lib/business-context';
import { Product } from '@/lib/types';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { useCategories, EXTRA_COLORS, humanize } from '@/hooks/use-category';
import type { Cat } from '@/hooks/use-category';
import {
  Barcode, X, Camera, CheckCircle, Loader2, Package, Hash, Layers, RotateCcw,
  Info, Save, AlertCircle, ScanBarcode, Zap, ImagePlus, Trash2, Plus, Minus,
  Tag, Check, Banknote, Boxes, UploadCloud, Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductFormProps {
  product: Product | null;
  onSuccess: () => void;
  onCancel: () => void;
}

/* ───────────────────────── tokens & data ───────────────────────── */

const LIME  = 'hsl(var(--brand-lime))';
const LEAF  = 'hsl(var(--brand-leaf))';
const EMER  = 'hsl(var(--brand-emerald))';
const AMBER = '#f59e0b';
const RED   = '#ef4444';
const tint  = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

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
  return data.secure_url as string;
}

const FIELD_ORDER = ['name', 'category', 'sku', 'piecePrice', 'boxQty', 'boxPrice'];

/* ───────────────────────── form ───────────────────────── */

export function ProductForm({ product, onSuccess, onCancel }: ProductFormProps) {
  const { activeBusiness } = useBusiness();
  const isEdit = !!product;

  /* form state */
  // Current real stock — the number sales have been correctly decrementing.
  // Everything else derives from it.
  const initialQuantity   = product?.quantity ?? 0;
  const initialBoxQty     = (product as any)?.boxQty     ?? 12;
  const initialBoxEnabled = (product as any)?.boxEnabled ?? false;

  const [form, setForm] = useState({
    name:          product?.name     ?? '',
    brand:         product?.brand    ?? '',
    sku:           product?.sku      ?? '',
    category:      product?.category ?? '',
    quantity:      initialQuantity,
    // Derive boxes / loose pieces from the CURRENT quantity, never from the stored
    // openingBoxes / loosePieces (those are only written at creation and go stale
    // as sales deduct stock — saving from them would wipe out every sale).
    openingBoxes:  initialBoxEnabled ? Math.floor(initialQuantity / initialBoxQty) : 0,
    loosePieces:   initialBoxEnabled ? initialQuantity % initialBoxQty             : 0,
    description:   product?.description ?? '',
    pieceCost:     (product as any)?.pieceCost  ?? 0,
    piecePrice:    (product as any)?.piecePrice ?? product?.sellingPrice ?? 0,
    boxEnabled:    initialBoxEnabled,
    boxQty:        initialBoxQty,
    boxCost:       (product as any)?.boxCost  ?? 0,
    boxPrice:      (product as any)?.boxPrice ?? 0,
    lowStockAlert: product?.lowStockAlert ?? 5,
  });

  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');

  const set = useCallback((key: string, val: string | number | boolean) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }, []);

  /* categories — defaults + the custom ones this business has saved in Firestore */
  const { categories, loading: catsLoading, addCategory } = useCategories();

  // Keep an old product's category visible even if it was never saved to Firestore
  const allCategories = useMemo<Cat[]>(() => {
    const legacy = product?.category;
    if (legacy && !categories.some((c) => c.value === legacy)) {
      return [...categories, { value: legacy, label: humanize(legacy), color: EXTRA_COLORS[0], custom: true }];
    }
    return categories;
  }, [categories, product?.category]);

  const selectedCat = allCategories.find((c) => c.value === form.category);

  const [showCatInput, setShowCatInput] = useState(false);
  const [newCatLabel, setNewCatLabel]   = useState('');
  const [catSaving, setCatSaving]       = useState(false);

  const addCustomCategory = async () => {
    if (!newCatLabel.trim() || catSaving) return;
    setCatSaving(true);
    try {
      const cat = await addCategory(newCatLabel); // saved to Firestore, or returns the existing one
      if (cat) {
        set('category', cat.value);
        setNewCatLabel('');
        setShowCatInput(false);
      }
    } catch {
      setErrors((e) => ({ ...e, category: 'Could not save the category. Please try again.' }));
    } finally {
      setCatSaving(false);
    }
  };

  /* boxes & stock */
  const updateQuantityFromBoxes = (boxes: number, loose: number, boxQty: number) =>
    set('quantity', boxes * boxQty + loose);

  const handleOpeningBoxes = (val: number) => { set('openingBoxes', val); updateQuantityFromBoxes(val, form.loosePieces, form.boxQty); };
  const handleLoosePieces  = (val: number) => { set('loosePieces', val);  updateQuantityFromBoxes(form.openingBoxes, val, form.boxQty); };

  const handleBoxQtyChange = (qty: number) => {
    set('boxQty', qty);
    if (form.piecePrice > 0) set('boxPrice', parseFloat((form.piecePrice * qty).toFixed(2)));
    if (form.pieceCost  > 0) set('boxCost',  parseFloat((form.pieceCost  * qty).toFixed(2)));
    if (form.boxEnabled) updateQuantityFromBoxes(form.openingBoxes, form.loosePieces, qty);
  };

  // Turning boxes on re-derives boxes/loose from the live quantity so the steppers
  // never show 0 while real stock exists (which would corrupt the next edit).
  const toggleBox = (on: boolean) => {
    setForm((f) => ({
      ...f,
      boxEnabled: on,
      ...(on ? {
        openingBoxes: Math.floor(f.quantity / f.boxQty),
        loosePieces:  f.quantity % f.boxQty,
        boxPrice: f.boxPrice || (f.piecePrice > 0 ? parseFloat((f.piecePrice * f.boxQty).toFixed(2)) : 0),
        boxCost:  f.boxCost  || (f.pieceCost  > 0 ? parseFloat((f.pieceCost  * f.boxQty).toFixed(2)) : 0),
      } : {}),
    }));
    if (!on) setErrors((e) => { const n = { ...e }; delete n.boxQty; delete n.boxPrice; return n; });
  };

  const suggestedBoxPrice = form.piecePrice > 0 ? parseFloat((form.piecePrice * form.boxQty).toFixed(2)) : 0;
  const stockStatus = form.quantity === 0 ? 'out' : form.quantity <= form.lowStockAlert ? 'low' : 'in';

  /* image */
  const camRef  = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile]           = useState<File | null>(null);
  const [imagePreview, setImagePreview]     = useState<string>(product?.imageUrl ?? '');
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError]         = useState('');
  const [dragOver, setDragOver]             = useState(false);

  const pickFile = (file?: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024)       { setImageError('Image must be under 5 MB'); return; }
    if (!file.type.startsWith('image/'))   { setImageError('Only image files are allowed'); return; }
    setImageError('');
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };
  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => { pickFile(e.target.files?.[0]); e.target.value = ''; };

  /* scanner */
  const [scanMsg, setScanMsg] = useState('');

  const handleScan = useCallback((code: string) => {
    const normalised = code.trim().toUpperCase();
    set('sku', normalised);
    setScanMsg(normalised);
  }, [set]);

  const { scannerState, cameraError, videoRef, startCamera, stopCamera, externalEnabled, setExternalEnabled } =
    useBarcodeScanner({ onScan: handleScan });

  const scanning    = scannerState === 'starting' || scannerState === 'active';
  const cameraReady = scannerState === 'active';

  /* validation */
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())    e.name       = 'Product name is required';
    if (!form.sku.trim())     e.sku        = 'Barcode / SKU is required';
    if (!form.category)       e.category   = 'Please select a category';
    if (form.piecePrice <= 0) e.piecePrice = 'Selling price per piece is required';
    if (form.boxEnabled && form.boxQty < 2)    e.boxQty   = 'Box must contain at least 2 units';
    if (form.boxEnabled && form.boxPrice <= 0) e.boxPrice = 'Box selling price is required';
    setErrors(e);
    const first = FIELD_ORDER.find((k) => e[k]);
    if (first) requestAnimationFrame(() =>
      document.getElementById(`field-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    return Object.keys(e).length === 0;
  };

  const jumpTo = (key: string) =>
    document.getElementById(`field-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  /* submit */
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
      } else if (!imagePreview) {
        imageUrl = '';
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

  /* completeness */
  const checklist = [
    { key: 'name',       label: 'Product name',  done: !!form.name.trim() },
    { key: 'category',   label: 'Category',      done: !!form.category },
    { key: 'sku',        label: 'Barcode / SKU', done: !!form.sku.trim() },
    { key: 'piecePrice', label: 'Selling price', done: form.piecePrice > 0 },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  /* ─────────────────────── render ─────────────────────── */
  return (
    <>
      {/* Scanner overlay */}
      <AnimatePresence>
        {scanning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--brand-deep)/0.92)] p-4 backdrop-blur-md">
            <motion.div initial={{ scale: 0.94, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0 }} className="w-full max-w-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: tint(LIME, 16) }}>
                    <ScanBarcode className="h-[18px] w-[18px]" style={{ color: LIME }} />
                  </div>
                  <div>
                    <h3 className="font-heading text-sm font-semibold text-white">Scan barcode</h3>
                    <p className="text-xs text-white/50">Point the camera at any product barcode</p>
                  </div>
                </div>
                <button type="button" onClick={stopCamera} aria-label="Close scanner"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-black ring-1 ring-white/10">
                <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                {!cameraReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[hsl(var(--brand-deep))]">
                    <Loader2 className="mb-2 h-6 w-6 animate-spin" style={{ color: LIME }} />
                    <p className="text-xs text-white/50">Starting camera…</p>
                  </div>
                )}
                {cameraReady && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="relative z-10 h-28 w-4/5">
                      {['top-0 left-0 border-t-2 border-l-2 rounded-tl-xl', 'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
                        'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl', 'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl',
                      ].map((cls) => <div key={cls} className={`absolute h-7 w-7 border-[hsl(var(--brand-lime))] ${cls}`} />)}
                      <motion.div className="absolute left-2 right-2 h-[2px]"
                        style={{ background: `linear-gradient(90deg, transparent, ${LIME}, transparent)`, boxShadow: `0 0 12px ${LIME}` }}
                        animate={{ top: ['8%', '88%', '8%'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
                    </div>
                  </div>
                )}
              </div>
              {cameraError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/15 px-4 py-3 text-center text-sm text-red-400">{cameraError}</div>
              )}
              <p className="text-center text-xs text-white/40">Detects automatically — no button needed</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

          {/* ══ MAIN COLUMN ══ */}
          <div className="space-y-4 lg:col-span-8">

            {/* Basic information */}
            <Section icon={Package} title="Basic information" desc="What you sell, and how it’s grouped.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field id="name" label="Product name" required error={errors.name}>
                    <TextInput value={form.name} onChange={(e) => set('name', e.target.value)}
                      placeholder="e.g. Nike Air Max 270" error={!!errors.name} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Brand" hint="Optional">
                    <TextInput value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="e.g. Nike" />
                  </Field>
                </div>

                <div className="sm:col-span-2">
                  <Field id="category" label="Category" required error={errors.category}>
                    <div className="flex flex-wrap gap-2">
                      {allCategories.map((c) => {
                        const active = form.category === c.value;
                        return (
                          <button key={c.value} type="button" onClick={() => set('category', c.value)}
                            className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-all ${
                              active ? 'text-foreground' : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'}`}
                            style={active ? { background: tint(c.color, 14), borderColor: c.color } : undefined}>
                            {active
                              ? <Check className="h-3.5 w-3.5" style={{ color: c.color }} />
                              : <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />}
                            {c.label}
                          </button>
                        );
                      })}

                      {catsLoading && (
                        <span className="inline-flex h-9 items-center gap-1.5 px-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your categories…
                        </span>
                      )}

                      {showCatInput ? (
                        <div className="flex items-center gap-1.5">
                          <input value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomCategory())}
                            placeholder="Category name"
                            disabled={catSaving}
                            className="h-9 w-40 rounded-full border border-[hsl(var(--ring))] bg-background px-3.5 text-[13px] outline-none ring-4 ring-[hsl(var(--ring)/0.15)] placeholder:text-muted-foreground disabled:opacity-60" />
                          <button type="button" onClick={addCustomCategory} disabled={catSaving}
                            className="inline-flex h-9 min-w-[3.25rem] items-center justify-center rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-[filter] hover:brightness-110 disabled:opacity-60">
                            {catSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
                          </button>
                          <button type="button" onClick={() => { setShowCatInput(false); setNewCatLabel(''); }} aria-label="Cancel"
                            disabled={catSaving}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setShowCatInput(true)} disabled={catsLoading}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-border px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-[hsl(var(--brand-leaf))] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">
                          <Plus className="h-3.5 w-3.5" /> New category
                        </button>
                      )}
                    </div>
                  </Field>
                </div>

                <div className="sm:col-span-2">
                  <Field label="Description" hint="Optional">
                    <div className={`${shell(false)} items-start py-2.5`}>
                      <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3}
                        placeholder="Specs, notes, or any extra details…"
                        className="min-w-0 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                    </div>
                  </Field>
                </div>
              </div>
            </Section>

            {/* Photo */}
            <Section icon={ImagePlus} title="Product photo" desc="Shown on receipts, product cards and in your inventory.">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div
                  onClick={() => !imagePreview && fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
                  className={`relative flex h-36 w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 transition-colors sm:w-36 ${
                    imagePreview ? 'border-border bg-muted' : 'cursor-pointer border-dashed border-input bg-muted/40 hover:border-[hsl(var(--brand-leaf))] hover:bg-[hsl(var(--brand-lime)/0.06)]'
                  } ${dragOver ? 'border-dashed border-[hsl(var(--brand-leaf))] bg-[hsl(var(--brand-lime)/0.10)]' : ''}`}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="Product preview" className="h-full w-full object-contain p-1" />
                  ) : (
                    <div className="px-3 text-center">
                      <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: tint(LIME, 16) }}>
                        <UploadCloud className="h-5 w-5 text-primary" />
                      </span>
                      <p className="text-xs font-medium">Drop an image</p>
                      <p className="text-[11px] text-muted-foreground">or click to browse</p>
                    </div>
                  )}
                  {imageUploading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <p className="text-xs font-medium">Uploading…</p>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{imagePreview ? 'Looking good' : 'Add a clear, well-lit photo'}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">PNG or JPG, up to 5 MB. A plain background works best.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => camRef.current?.click()}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3.5 text-[13px] font-medium transition-colors hover:bg-accent">
                      <Camera className="h-3.5 w-3.5 text-muted-foreground" /> Take photo
                    </button>
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3.5 text-[13px] font-medium transition-colors hover:bg-accent">
                      <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" /> {imagePreview ? 'Replace' : 'Upload'}
                    </button>
                    {imagePreview && (
                      <button type="button" onClick={() => { setImageFile(null); setImagePreview(''); }}
                        className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-red-500 transition-colors hover:bg-red-500/10">
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    )}
                  </div>
                  {imageError && (
                    <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
                      <AlertCircle className="h-3.5 w-3.5" />{imageError}
                    </p>
                  )}
                </div>
              </div>
              <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={onFileInput} className="hidden" />
              <input ref={fileRef} type="file" accept="image/*" onChange={onFileInput} className="hidden" />
            </Section>

            {/* Barcode */}
            <Section icon={Barcode} title="Barcode / SKU" desc="Scan it in, or type your own code.">
              <div className={`mb-4 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${externalEnabled ? '' : 'border-border bg-muted/30'}`}
                style={externalEnabled ? { background: tint(LIME, 9), borderColor: tint(LEAF, 38) } : undefined}>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: externalEnabled ? tint(LIME, 22) : 'hsl(var(--muted))' }}>
                    <Zap className={`h-4 w-4 ${externalEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium">External scanner</p>
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {externalEnabled && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: LIME }} />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: LEAF }} />
                        </span>
                      )}
                      {externalEnabled ? 'Listening for scans' : 'USB or Bluetooth barcode gun'}
                    </p>
                  </div>
                </div>
                <Switch checked={externalEnabled} onChange={setExternalEnabled} label="External scanner" />
              </div>

              <Field id="sku" label="Barcode or SKU" required error={errors.sku}>
                <div className="flex gap-2">
                  <div className={`${shell(!!errors.sku)} flex-1`}>
                    <Hash className="mr-2.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <input value={form.sku} onChange={(e) => { set('sku', e.target.value.toUpperCase()); setScanMsg(''); }}
                      placeholder="Scan or type a code"
                      className={`${bare} font-mono font-semibold tracking-wider`} />
                    {form.sku && (
                      <button type="button" aria-label="Clear code"
                        onClick={() => { set('sku', ''); setScanMsg(''); stopCamera(); }}
                        className="ml-2 rounded-md p-1 text-muted-foreground transition-colors hover:text-red-500">
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={scanning ? stopCamera : startCamera}
                    className="inline-flex h-11 flex-shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-[filter] hover:brightness-110">
                    <Camera className="h-4 w-4" /><span className="hidden sm:inline">Scan</span>
                  </motion.button>
                </div>
              </Field>

              <AnimatePresence>
                {scanMsg && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden">
                    <div className="mt-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm" style={{ background: tint(LIME, 14) }}>
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span className="font-medium">Scanned</span>
                      <code className="rounded-md bg-background/70 px-1.5 py-0.5 font-mono text-xs">{scanMsg}</code>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 flex-shrink-0" />Supports EAN-13, UPC, QR and Code128.
              </p>
            </Section>

            {/* Pricing */}
            <Section icon={Banknote} title="Pricing" desc="Set what you pay and what you charge. Margins update live.">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                {/* Per piece */}
                <div className="space-y-3.5 rounded-2xl border border-border p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Tag className="h-3.5 w-3.5" />
                      </span>
                      <p className="font-heading text-sm font-semibold">Per piece</p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Required</span>
                  </div>

                  <Field label="Cost price" hint="What you paid">
                    <MoneyInput value={form.pieceCost} onChange={(v) => set('pieceCost', v)} />
                  </Field>
                  <Field id="piecePrice" label="Selling price" required error={errors.piecePrice}>
                    <MoneyInput value={form.piecePrice} onChange={(v) => set('piecePrice', v)} error={!!errors.piecePrice} strong accent={EMER} />
                  </Field>

                  <AnimatePresence>
                    {form.piecePrice > 0 && form.pieceCost > 0 && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <Margin price={form.piecePrice} cost={form.pieceCost} label="Piece margin" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Per box */}
                <div className={`space-y-3.5 rounded-2xl border p-3.5 transition-colors ${form.boxEnabled ? 'border-border' : 'border-dashed border-border bg-muted/20'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full transition-colors"
                        style={form.boxEnabled ? { background: AMBER, color: '#fff' } : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                        <Boxes className="h-3.5 w-3.5" />
                      </span>
                      <p className="font-heading text-sm font-semibold">Per box</p>
                      {!form.boxEnabled && <span className="text-[11px] text-muted-foreground">Optional</span>}
                    </div>
                    <Switch checked={form.boxEnabled} onChange={toggleBox} label="Sell by the box" />
                  </div>

                  {!form.boxEnabled ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Sell this by the box as well? Turn it on to set box pricing and track stock in boxes and loose pieces.
                    </p>
                  ) : (
                    <>
                      <Field id="boxQty" label="Pieces per box" error={errors.boxQty}>
                        <Stepper value={form.boxQty} min={2} onChange={handleBoxQtyChange} />
                      </Field>
                      <Field label="Box cost" hint="What you paid">
                        <MoneyInput value={form.boxCost} onChange={(v) => set('boxCost', v)} />
                      </Field>
                      <Field id="boxPrice" label="Box selling price" required error={errors.boxPrice}>
                        <MoneyInput value={form.boxPrice} onChange={(v) => set('boxPrice', v)} error={!!errors.boxPrice} strong accent={AMBER} />
                      </Field>

                      {suggestedBoxPrice > 0 && form.boxPrice !== suggestedBoxPrice && (
                        <button type="button" onClick={() => set('boxPrice', suggestedBoxPrice)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:brightness-95"
                          style={{ background: tint(AMBER, 14), color: '#d97706' }}>
                          <Sparkles className="h-3 w-3" />
                          Use ₵{suggestedBoxPrice.toLocaleString()} ({form.boxQty} × ₵{form.piecePrice})
                        </button>
                      )}

                      <AnimatePresence>
                        {form.boxPrice > 0 && form.boxCost > 0 && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <Margin price={form.boxPrice} cost={form.boxCost} label="Box margin" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>
              </div>
            </Section>

            {/* Stock */}
            <Section icon={Layers} title="Stock levels"
              desc={isEdit ? 'What you have on hand right now.' : 'How much you’re starting with, and when to be warned.'}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {form.boxEnabled && form.boxQty > 1 ? (
                  <>
                    <Field label={isEdit ? 'Boxes in stock' : 'Opening boxes'} hint={`${form.boxQty} pcs each`}>
                      <Stepper value={form.openingBoxes} onChange={handleOpeningBoxes} tone={AMBER} />
                    </Field>
                    <Field label="Loose pieces" hint="Not in a box">
                      <Stepper value={form.loosePieces} onChange={handleLoosePieces} />
                    </Field>
                  </>
                ) : (
                  <Field label={isEdit ? 'Units in stock' : 'Opening stock'} hint="Units available">
                    <Stepper value={form.quantity} onChange={(v) => set('quantity', v)} />
                  </Field>
                )}

                <Field label="Low stock alert" hint="Warn me at or below">
                  <Stepper value={form.lowStockAlert} min={1} onChange={(v) => set('lowStockAlert', v)} tone={AMBER} />
                </Field>
              </div>

              {/* live total */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5"
                style={{
                  background: tint(stockStatus === 'out' ? RED : stockStatus === 'low' ? AMBER : LEAF, 8),
                  borderColor: tint(stockStatus === 'out' ? RED : stockStatus === 'low' ? AMBER : LEAF, 30),
                }}>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Total units in stock</p>
                  <p className="font-heading text-2xl font-semibold tabular-nums">
                    {form.quantity.toLocaleString()}
                    {form.boxEnabled && form.boxQty > 1 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {form.openingBoxes} box{form.openingBoxes !== 1 ? 'es' : ''} + {form.loosePieces} pc{form.loosePieces !== 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
                <StatusChip status={stockStatus} />
              </div>
            </Section>
          </div>

          {/* ══ SIDE COLUMN ══ */}
          <div className="space-y-4 lg:col-span-4">
            <div className="space-y-4 lg:sticky lg:top-4">

              {/* Live preview */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="relative flex aspect-[16/10] items-center justify-center"
                  style={{ background: selectedCat ? tint(selectedCat.color, 13) : 'hsl(var(--muted))' }}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="" className="h-full w-full object-contain p-3" />
                  ) : (
                    <Package className="h-12 w-12 opacity-60" style={{ color: selectedCat?.color ?? 'hsl(var(--muted-foreground))' }} />
                  )}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-semibold backdrop-blur">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: LIME }} />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: LEAF }} />
                    </span>
                    Live preview
                  </span>
                  {form.quantity >= 0 && (form.name || form.piecePrice > 0 || form.quantity > 0) && (
                    <span className="absolute right-3 top-3"><StatusChip status={stockStatus} small /></span>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <p className={`font-heading text-base font-semibold leading-snug ${form.name ? '' : 'text-muted-foreground/50'}`}>
                      {form.name || 'Product name'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{form.brand || 'No brand'}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedCat ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: tint(selectedCat.color, 12) }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: selectedCat.color }} />{selectedCat.label}
                      </span>
                    ) : (
                      <span className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground/60">Category</span>
                    )}
                    {form.sku ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs font-medium">
                        <Barcode className="h-3 w-3 text-muted-foreground" />{form.sku}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">No barcode yet</span>
                    )}
                  </div>

                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">Per piece</span>
                      <span className="font-heading text-xl font-semibold tabular-nums">
                        {form.piecePrice > 0 ? `₵${form.piecePrice.toLocaleString()}` : <span className="text-muted-foreground/40">₵0</span>}
                      </span>
                    </div>
                    {form.boxEnabled && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">Per box · {form.boxQty} pcs</span>
                        <span className="text-sm font-semibold tabular-nums" style={{ color: '#d97706' }}>
                          {form.boxPrice > 0 ? `₵${form.boxPrice.toLocaleString()}` : '—'}
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">In stock</span>
                      <span className="text-sm font-semibold tabular-nums">{form.quantity.toLocaleString()} {form.quantity === 1 ? 'unit' : 'units'}</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Completeness */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="font-heading text-sm font-semibold">{doneCount === checklist.length ? 'Ready to save' : 'Before you save'}</p>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">{doneCount}/{checklist.length}</span>
                </div>
                <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div className="h-full rounded-full" initial={false}
                    animate={{ width: `${(doneCount / checklist.length) * 100}%` }}
                    style={{ background: `linear-gradient(90deg, ${EMER}, ${LIME})` }} />
                </div>
                <ul className="space-y-0.5">
                  {checklist.map((c) => (
                    <li key={c.key}>
                      <button type="button" onClick={() => !c.done && jumpTo(c.key)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-[13px] transition-colors ${c.done ? 'cursor-default' : 'hover:bg-muted'}`}>
                        <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border transition-colors"
                          style={c.done ? { background: LEAF, borderColor: LEAF } : { borderColor: 'hsl(var(--border))' }}>
                          {c.done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </span>
                        <span className={c.done ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'font-medium'}>{c.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {globalError && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden">
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />{globalError}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sticky action bar */}
        <div className="sticky bottom-3 z-20 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/90 p-2.5 shadow-lg backdrop-blur-md">
          <div className="hidden min-w-0 items-center gap-3 pl-1 sm:flex">
            {activeBusiness && (
              <>
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl font-heading text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(140deg, hsl(var(--brand-deep)), hsl(var(--brand-forest)))' }}>
                  {activeBusiness.name.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{isEdit ? 'Updating in' : 'Adding to'}</p>
                  <p className="truncate text-[13px] font-semibold">{activeBusiness.name}</p>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-1 gap-2 sm:flex-none">
            <button type="button" onClick={onCancel}
              className="h-11 flex-1 rounded-xl border border-border bg-background px-5 text-sm font-medium transition-colors hover:bg-accent sm:flex-none">
              Cancel
            </button>
            <motion.button type="submit" disabled={saving || saved} whileTap={{ scale: 0.97 }}
              className="inline-flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none">
              {saved ? <><CheckCircle className="h-4 w-4" /> Saved</>
                : saving ? <><Loader2 className="h-4 w-4 animate-spin" /> {imageUploading ? 'Uploading…' : 'Saving…'}</>
                : <><Save className="h-4 w-4" /> {isEdit ? 'Update product' : 'Add to inventory'}</>}
            </motion.button>
          </div>
        </div>
      </form>
    </>
  );
}

/* ───────────────────────── building blocks ───────────────────────── */

// Input container: the icon / prefix / suffix live INSIDE it, so nothing ever overlaps the text
const shell = (error?: boolean) =>
  `flex items-center rounded-xl border bg-muted/40 px-3.5 transition-all focus-within:bg-background focus-within:ring-4 ${
    error
      ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-500/15'
      : 'border-input focus-within:border-[hsl(var(--ring))] focus-within:ring-[hsl(var(--ring)/0.15)]'}`;
const bare = 'h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground';
const noSpin = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

function Section({ icon: Icon, title, desc, children }: {
  icon: React.ElementType; title: string; desc?: string; children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex items-start gap-3 border-b border-border px-4 py-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
          style={{ background: tint(LIME, 18) }}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <h3 className="font-heading text-[15px] font-semibold leading-tight">{title}</h3>
          {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ id, label, required, hint, error, children }: {
  id?: string; label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div id={id ? `field-${id}` : undefined} className="scroll-mt-28">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label className="text-[13px] font-medium">
          {label}{required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
      <FieldError msg={error} />
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{msg}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function TextInput({ error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <div className={shell(error)}>
      <input {...props} className={bare} />
    </div>
  );
}

function MoneyInput({ value, onChange, error, strong, accent }: {
  value: number; onChange: (v: number) => void; error?: boolean; strong?: boolean; accent?: string;
}) {
  return (
    <div className={shell(error)}>
      <span className="mr-2 text-sm font-semibold" style={{ color: accent ?? 'hsl(var(--muted-foreground))' }}>₵</span>
      <input type="number" min="0" step="0.01" inputMode="decimal" value={value || ''} placeholder="0.00"
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`${bare} ${noSpin} tabular-nums ${strong ? 'font-semibold' : ''}`} />
    </div>
  );
}

function Stepper({ value, onChange, min = 0, tone }: {
  value: number; onChange: (v: number) => void; min?: number; tone?: string;
}) {
  const btn = 'flex w-11 flex-shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-muted';
  return (
    <div className="flex h-11 items-stretch overflow-hidden rounded-xl border border-input bg-muted/40 transition-all focus-within:border-[hsl(var(--ring))] focus-within:ring-4 focus-within:ring-[hsl(var(--ring)/0.15)]">
      <button type="button" aria-label="Decrease" onClick={() => onChange(Math.max(min, value - 1))} className={btn}>
        <Minus className="h-4 w-4" />
      </button>
      <input type="number" min={min} value={value || ''} placeholder="0"
        onChange={(e) => onChange(Math.max(min, parseInt(e.target.value) || min))}
        style={tone ? { color: tone } : undefined}
        className={`min-w-0 flex-1 border-x border-input bg-background text-center font-heading text-base font-semibold tabular-nums outline-none ${noSpin}`} />
      <button type="button" aria-label="Increase" onClick={() => onChange(value + 1)} className={btn}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-border'}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

function StatusChip({ status, small }: { status: 'in' | 'low' | 'out'; small?: boolean }) {
  const c = status === 'out' ? RED : status === 'low' ? AMBER : LEAF;
  const label = status === 'out' ? 'Out of stock' : status === 'low' ? 'Low stock' : 'In stock';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${small ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`}
      style={{ background: small ? 'hsl(var(--background) / 0.85)' : tint(c, 16), color: status === 'in' ? EMER : status === 'low' ? '#d97706' : RED }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />{label}
    </span>
  );
}

function Margin({ price, cost, label }: { price: number; cost: number; label: string }) {
  const amount = price - cost;
  const pct    = price > 0 ? Math.round((amount / price) * 100) : 0;
  const tone   = amount > 0 ? LEAF : amount === 0 ? AMBER : RED;
  const text   = amount > 0 ? 'text-[hsl(var(--brand-emerald))] dark:text-[hsl(var(--brand-lime))]'
               : amount === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500';
  const costShare = amount > 0 ? Math.min(100, (cost / price) * 100) : 100;
  return (
    <div className="rounded-xl border px-3.5 py-2.5" style={{ background: tint(tone, 8), borderColor: tint(tone, 28) }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${text}`} style={{ background: tint(tone, 16) }}>
          {pct}%
        </span>
      </div>
      <p className={`mt-1 font-heading text-lg font-semibold tabular-nums ${text}`}>
        ₵{Math.abs(amount).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        <span className="ml-1.5 text-xs font-medium">{amount < 0 ? 'loss' : 'profit'}</span>
      </p>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
        <div style={{ width: `${costShare}%`, background: amount > 0 ? 'hsl(var(--muted-foreground) / 0.35)' : tone }} />
        {amount > 0 && <div className="flex-1" style={{ background: tone }} />}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>Cost ₵{cost.toLocaleString()}</span>
        <span>Sells ₵{price.toLocaleString()}</span>
      </div>
    </div>
  );
}