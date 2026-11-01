'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProductForm } from '@/components/dashboard/product-form';

export default function AddProductPage() {
  const router = useRouter();

  return (
    <div className="relative min-h-full bg-background text-foreground">
      {/* soft brand glow behind the header */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(60%_100%_at_50%_0%,hsl(var(--brand-lime)/0.10),transparent)]"
      />
      {/* brand accent line */}
      <div
        aria-hidden
        className="relative h-[2px] w-full"
        style={{
          background:
            'linear-gradient(90deg, hsl(var(--brand-emerald)), hsl(var(--brand-leaf)), hsl(var(--brand-lime)), transparent)',
        }}
      />

      <div className="relative mx-auto max-w-6xl space-y-5 px-3 py-4 sm:px-4 lg:px-6">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="group inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-[13px] font-medium text-muted-foreground shadow-sm transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to products
          </button>

          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--brand-lime)/0.16)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--brand-leaf))]" />
              Inventory
            </span>
            <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Add product
              <span className="text-[hsl(var(--brand-leaf))]">.</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Fill in the details below, or scan a barcode to fill the SKU for you.
            </p>
          </div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <ProductForm
            product={null}
            onSuccess={() => router.push('/dashboard/products')}
            onCancel={() => router.back()}
          />
        </motion.div>
      </div>
    </div>
  );
}