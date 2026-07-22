# Finbuy IMS - Quick Start Guide

Get the Finbuy Inventory Management System up and running in 10 minutes!

## 5-Minute Setup

### Step 1: Setup Firebase (5 minutes)

1. Go to https://console.firebase.google.com/
2. Click "Add project" → name it "finbuy-ims" → Create
3. Once created, go to **Authentication** → **Get Started** → Enable **Email/Password**
4. Go to **Firestore Database** → **Create Database** → Start in test mode → Create
5. Go to **Project Settings** (gear icon) → **Your apps** → Click `</>` Web
6. Copy your Firebase config and save it

### Step 2: Install Project (1 minute)

```bash
# Clone or download the project
cd finbuy-ims

# Install dependencies
pnpm install
```

### Step 3: Add Environment Variables (1 minute)

Create `.env.local` file in the project root:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_value
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_value
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_value
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_value
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_value
NEXT_PUBLIC_FIREBASE_APP_ID=your_value
```

Replace `your_value` with values from your Firebase config.

### Step 4: Run the App (1 minute)

```bash
pnpm dev
```

Open http://localhost:3000 in your browser.

### Step 5: Create Your First Account (1 minute)

1. Click "Register here"
2. Fill in:
   - Name: `Your Name`
   - Email: `your@email.com`
   - Password: `Password123!`
   - Role: `Admin`
3. Click "Create Account"
4. You're now logged in!

## First Steps in the App

### 1. Add Your First Product

1. Click "Products" in the sidebar
2. Click "Add Product" button
3. Fill in:
   - Name: `Samsung 55" TV`
   - Category: `Home Appliances`
   - Brand: `Samsung`
   - SKU: `SAM-TV-001`
   - Quantity: `10`
   - Cost Price: `250000`
   - Selling Price: `350000`
   - Supplier: `Tech Store`
4. Click "Add Product"

### 2. Record Your First Sale

1. Click "Record Sale" in the sidebar
2. Select your product: `Samsung 55" TV`
3. Enter:
   - Quantity Sold: `1`
   - Unit Price: `350000` (auto-filled)
4. Click "Record Sale"
5. Notice the quantity decreased from 10 to 9!

### 3. Check Your Dashboard

1. Click "Dashboard" to see your stats
2. You should see:
   - 1 Total Product
   - 1 Total Sale
   - Updated inventory value

### 4. View Reports

1. Click "Reports" in the sidebar
2. See your revenue chart and sales breakdown
3. Try switching between Day/Week/Month views

### 5. Check Stock Alerts

1. Click "Stock Alerts" in the sidebar
2. If you have products with qty < 20, they'll appear here

## Common Tasks

### Add More Products

**Path**: Dashboard → Products → Add Product

Fill in product details and click "Add Product"

### Record a Sale

**Path**: Dashboard → Record Sale

1. Select product
2. Enter quantity and price
3. Click "Record Sale"

### View Analytics

**Path**: Dashboard → Reports

- See revenue trends
- View category breakdown
- Filter by time period

### Manage Users

**Path**: Dashboard → Users (Admin only)

- View all users
- Delete users
- See user roles

## Understanding Roles

### Admin
- Full access to everything
- Can add/delete products
- Can manage users
- Can access all reports

### Sales Staff
- Can record sales
- Can view products
- Can check stock

### Manager
- Can view stock levels
- Can see alerts
- Can access reports
- Cannot modify products

## Troubleshooting

### "Login page keeps showing"
- Check your `.env.local` file
- Verify Firebase config values are correct
- Restart the dev server

### "Product won't save"
- Check Firestore is created in Firebase
- Verify all required fields are filled
- Check browser console for errors

### "Sales not updating quantity"
- Ensure product is selected
- Check quantity is entered correctly
- Verify Firestore Rules allow writes

## Next Steps

1. **Add Sample Data**: See `SAMPLE_DATA.md` for test data
2. **Read Full Docs**: Check `README.md` for complete documentation
3. **Firebase Setup**: Review `FIREBASE_SETUP.md` for advanced config
4. **Deploy**: Use Vercel for easy hosting

## Feature Overview

```
📊 Dashboard
├── Quick stats overview
├── Key metrics (Products, Sales, Stock)
└── Quick action buttons

📦 Products
├── Browse all products
├── Search and filter
├── Add new products
├── Edit/Delete (Admin)
└── View stock levels

🛒 Record Sale
├── Select product
├── Enter quantity
├── Auto inventory update
└── Sales history

⚠️ Alerts
├── Low stock warnings
├── Critical items
└── Stock status

📈 Reports
├── Revenue trends
├── Category breakdown
├── Time range filtering
└── Key metrics

👥 Users (Admin)
├── View all users
├── User roles guide
└── Delete users

⚙️ Settings (Admin)
├── System info
├── Feature overview
└── Configuration

📱 Mobile Ready
├── Responsive design
├── Works on phones
└── Optimized interface
```

## Support Resources

- **Firebase Setup Guide**: `FIREBASE_SETUP.md`
- **Sample Data**: `SAMPLE_DATA.md`
- **Full Documentation**: `README.md`
- **Firebase Docs**: https://firebase.google.com/docs
- **Next.js Docs**: https://nextjs.org/docs

## Tips for Success

1. **Organize by Category**: Keep Home Appliances and Sneakers separate
2. **Use Meaningful SKUs**: Make product identification easier
3. **Monitor Stock Alerts**: Don't let products go out of stock
4. **Regular Reports**: Check analytics weekly
5. **Backup Data**: Firebase auto-backs up, but verify regularly

## Common Mistakes to Avoid

❌ Not setting up Firestore
❌ Wrong Firebase config values
❌ Forgetting to add quantities to products
❌ Not checking stock alerts regularly
❌ Adding duplicate products

✅ Test with sample data first
✅ Verify Firebase is working
✅ Use meaningful product names
✅ Keep roles organized
✅ Regular backups

## What's Included

```
✅ Complete authentication system
✅ Product management
✅ Sales recording with auto-inventory
✅ Real-time stock alerts
✅ Beautiful dashboard
✅ Advanced analytics & reports
✅ User management
✅ Role-based access control
✅ Professional UI/UX
✅ Mobile responsive design
✅ Dark & light mode support
✅ Production-ready code
✅ TypeScript support
✅ Firestore integration
✅ Security rules included
```

## Performance Tips

- Products load faster with smaller quantities
- Sales records load in real-time
- Reports generate on-demand
- Charts update automatically
- Search is instant

## Getting Help

1. Check the documentation files
2. Review error messages in browser console
3. Verify Firebase configuration
4. Check sample data for examples
5. Test with simple data first

---

**Ready to go?** Run `pnpm dev` and start building your inventory! 🚀
