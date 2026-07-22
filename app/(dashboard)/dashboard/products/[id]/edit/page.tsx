'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Product } from '@/lib/types';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProductForm } from '@/components/dashboard/product-form';

export default function EditProductPage() {
  const router   = useRouter();
  const { id }   = useParams<{ id: string }>();

  const [product, setProduct]   = useState<Product | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    getDoc(doc(db, 'products', id)).then((snap) => {
      if (!snap.exists()) {
        setNotFound(true);
      } else {
        const d = snap.data();
        setProduct({
          id: snap.id,
          ...d,
          dateAdded:   d.dateAdded?.toDate()   || new Date(),
          lastUpdated: d.lastUpdated?.toDate() || new Date(),
        } as Product);
      }
    }).finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-full bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="h-[2px] w-full bg-gradient-to-r from-green-500 via-green-400 to-transparent" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">

        {/* Back nav */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => router.push('/dashboard/products')}
            className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-5 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Products
          </button>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
            <p className="text-sm text-gray-400">Loading product…</p>
          </div>
        ) : notFound ? (
          <div className="text-center py-32">
            <p className="text-lg font-bold text-gray-500">Product not found</p>
            <button
              onClick={() => router.push('/dashboard/products')}
              className="mt-4 text-sm text-green-500 hover:underline font-semibold"
            >
              Back to Products
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
              <p className="text-xs font-bold text-green-500 uppercase tracking-[0.15em] mb-1">
                Inventory Management
              </p>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                Edit Product<span className="text-gray-300 dark:text-gray-600">.</span>
              </h1>
              <p className="text-sm text-gray-400 mt-1 truncate">
                Editing: <span className="font-semibold text-gray-600 dark:text-gray-300">{product?.name}</span>
              </p>
            </div>

            <ProductForm
              product={product}
              onSuccess={() => router.push('/dashboard/products')}
              onCancel={() => router.push('/dashboard/products')}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}