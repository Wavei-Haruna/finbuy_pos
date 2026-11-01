'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Product } from '@/lib/types';
import { ArrowLeft, Loader2, PackageSearch } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProductForm } from '@/components/dashboard/product-form';
import { button } from '@/components/home/site-config';

export default function EditProductPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    getDoc(doc(db, 'products', id))
      .then((snap) => {
        if (!snap.exists()) {
          setNotFound(true);
        } else {
          const d = snap.data();
          setProduct({
            id: snap.id,
            ...d,
            dateAdded: d.dateAdded?.toDate() || new Date(),
            lastUpdated: d.lastUpdated?.toDate() || new Date(),
          } as Product);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const backToProducts = () => router.push('/dashboard/products');

  return (
    <div className="min-h-full bg-muted">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
        {/* Back nav */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <button
            type="button"
            onClick={backToProducts}
            className="group mb-6 inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground transition-colors hover:border-primary"
          >
            <ArrowLeft className="h-4 w-4 text-primary transition-transform group-hover:-translate-x-0.5" />
            Back to products
          </button>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Loading product…</p>
          </div>
        ) : notFound ? (
          <div className="mx-auto max-w-md rounded-3xl border border-border bg-card px-6 py-14 text-center shadow-sm">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
              <PackageSearch className="h-6 w-6 text-primary" />
            </span>
            <h1 className="mt-5 font-heading text-xl font-bold text-foreground">
              Product not found
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              It may have been deleted, or the link is wrong.
            </p>
            <button type="button" onClick={backToProducts} className={`${button('primary', 'lg')} mt-6`}>
              Back to products
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="space-y-6"
          >
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Edit product
              </h1>
              <p className="mt-1.5 truncate text-sm text-muted-foreground">
                Editing{' '}
                <span className="font-semibold text-foreground">{product?.name}</span>
              </p>
            </div>

            <ProductForm
              product={product}
              onSuccess={backToProducts}
              onCancel={backToProducts}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}