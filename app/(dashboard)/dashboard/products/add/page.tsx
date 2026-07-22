'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProductForm } from '@/components/dashboard/product-form';

export default function AddProductPage() {
  const router = useRouter();

  return (
    <div className="min-h-full bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="h-[2px] w-full bg-gradient-to-r from-green-500 via-green-400 to-transparent" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-5 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Products
          </button>
          <p className="text-xs font-bold text-green-500 uppercase tracking-[0.15em] mb-1">Inventory Management</p>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            Add Product<span className="text-gray-300 dark:text-gray-600">.</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Fill in details below or scan a barcode to auto-fill the SKU</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
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