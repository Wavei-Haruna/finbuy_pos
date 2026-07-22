# Finbuy Inventory Management System (IMS)

A professional, production-ready inventory management system built with Next.js 16, React 19, Firebase, and Tailwind CSS. Designed specifically for Finbuy to manage home appliances and sneaker inventory with real-time updates, sales tracking, and comprehensive analytics.

## Features

### Core Features
- **Product Management**: Add, edit, delete, and search products with detailed information
- **Real-time Inventory**: Track stock levels in real-time across home appliances and sneakers
- **Sales Recording**: Log sales transactions with automatic inventory updates
- **Stock Alerts**: Get notified when products reach low stock levels
- **Analytics & Reports**: View daily, weekly, and monthly sales performance and insights
- **Role-Based Access**: Three-tier access control (Admin, Manager, Sales Staff)

### Technical Features
- **Firebase Backend**: Secure cloud-based database with real-time synchronization
- **Authentication**: Email/password authentication with role-based access control
- **Responsive Design**: Mobile-friendly interface with tailored experiences
- **Dark & Light Mode**: Theme support via Tailwind CSS
- **Gold & Black Theme**: Professional color scheme tailored to Finbuy branding
- **Real-time Charts**: Revenue trends and category breakdown visualization
- **Data Security**: Firestore security rules with role-based permissions

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Frontend**: React 19.2.3, Tailwind CSS 3.4.17
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **UI Components**: shadcn/ui with Radix UI
- **Charts**: Recharts for data visualization
- **Language**: TypeScript
- **Package Manager**: pnpm

## Quick Start

### 1. Prerequisites
- Node.js 18+ and pnpm
- Firebase account

### 2. Installation

```bash
# Clone or download the project
cd finbuy-ims

# Install dependencies
pnpm install
```

### 3. Firebase Setup

Follow the detailed guide in `FIREBASE_SETUP.md` to:
- Create a Firebase project
- Set up Authentication and Firestore
- Configure environment variables

### 4. Configure Environment Variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 5. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
finbuy-ims/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx (Overview)
│   │   │   ├��─ products/
│   │   │   ├── sales/
│   │   │   ├── alerts/
│   │   │   ├── reports/
│   │   │   ├── users/
│   │   │   └── settings/
│   │   └── layout.tsx
│   ├── layout.tsx
│   ├── page.tsx (Root redirect)
│   └── globals.css
├── components/
│   ├── dashboard/
│   │   ├── sidebar.tsx
│   │   ├── top-nav.tsx
│   │   ├── stats-card.tsx
│   │   └── product-form.tsx
│   └── ui/ (shadcn components)
├── lib/
│   ├── firebase.ts (Firebase config)
│   ├── auth-context.tsx (Auth provider)
│   ├── types.ts (TypeScript types)
│   └── utils.ts
└── public/
```

## User Roles & Permissions

### Admin
- Full system access
- Add, edit, delete products
- View all reports and analytics
- Manage users
- Access system settings

### Store Manager
- Monitor stock levels
- View stock alerts
- Access reports and analytics
- Cannot modify products or manage users

### Sales Staff
- Record sales transactions
- View product availability
- Check stock levels
- Cannot delete products or access admin features

## Database Schema

### Collections

#### users
```json
{
  "name": "string",
  "email": "string",
  "role": "admin" | "manager" | "sales",
  "createdAt": "timestamp"
}
```

#### products
```json
{
  "name": "string",
  "category": "home-appliances" | "sneakers",
  "brand": "string",
  "sku": "string",
  "quantity": "number",
  "costPrice": "number",
  "sellingPrice": "number",
  "supplier": "string",
  "size": "string" (sneakers only),
  "color": "string" (sneakers only),
  "dateAdded": "timestamp",
  "lastUpdated": "timestamp"
}
```

#### sales
```json
{
  "productId": "string",
  "quantity": "number",
  "price": "number",
  "totalAmount": "number",
  "recordedBy": "string",
  "recordedAt": "timestamp",
  "notes": "string"
}
```

## Key Pages & Features

### Dashboard (`/dashboard`)
- Quick overview with key metrics
- Total products count
- Low stock items count
- Total inventory value
- Sales count
- Quick action buttons

### Products (`/dashboard/products`)
- Browse all products with filters
- Search by name, SKU, or brand
- Filter by category
- Add new products
- Edit existing products
- Delete products (Admin only)
- Real-time quantity display

### Record Sale (`/dashboard/sales`)
- Select product and record sales
- Automatic inventory deduction
- Add notes to sales
- View recent sales history
- Display total sale amount

### Stock Alerts (`/dashboard/alerts`)
- Real-time low stock notifications
- Critical items (stock < 10)
- Warning items (stock 10-20)
- Supplier information
- Restock tracking

### Reports (`/dashboard/reports`)
- Revenue trend charts
- Sales by category breakdown
- Time range filtering (Day/Week/Month)
- Total revenue
- Units sold
- Average order value
- Top-selling products

### Users (`/dashboard/users`)
- View all system users
- User role management
- Delete users (Admin only)
- User creation guide

### Settings (`/dashboard/settings`)
- System configuration info
- Feature overview
- About section

## Authentication Flow

1. User visits `/` → redirected to `/login` if not authenticated
2. User can login with email/password or register new account
3. New users select their role (Admin/Manager/Sales)
4. After authentication, redirected to `/dashboard`
5. User session is maintained via Firebase Auth
6. User can logout from the top navigation menu

## Firestore Security Rules

The system uses role-based security rules:
- Users can only read their own profile
- Products readable by all authenticated users
- Only admins and sales staff can write products
- Only admins and sales staff can write sales records
- All other access is denied by default

## Styling & Theme

The application uses a professional gold and black color scheme:
- **Primary (Gold)**: `#FFD700` (HSL: 45 100% 51%)
- **Secondary (Black)**: `#1A1A1A` (HSL: 0 0% 13%)
- **Accents**: Various gray tones for hierarchy

The theme is configured in:
- `app/globals.css` - CSS variables
- `tailwind.config.ts` - Tailwind configuration
- Components use semantic design tokens

## API Routes

All data operations go through Firestore:
- No custom API routes needed
- Direct client-side Firestore operations
- Security enforced via Firestore Rules
- Real-time data synchronization

## Error Handling

- Try-catch blocks for async operations
- User-friendly error messages
- Console logging for debugging
- Validation on both client and database levels

## Performance Optimizations

- Server-side rendering for initial load
- Lazy loading of components
- Memoization of auth state
- Efficient Firestore queries
- Image optimization (future enhancement)

## Security Considerations

1. **Firebase Rules**: Enforce role-based access at database level
2. **Environment Variables**: Keep sensitive keys in `.env.local`
3. **HTTPS Only**: Deploy to HTTPS-only platforms
4. **Session Management**: Firebase handles secure sessions
5. **Input Validation**: Client and server-side validation
6. **No Sensitive Data**: Passwords hashed by Firebase Auth

## Deployment

### To Vercel
```bash
# Connect your GitHub repository
# Push to main branch
# Vercel will auto-deploy

# Make sure to add environment variables in Vercel dashboard
```

### To Other Platforms
1. Build the project: `pnpm build`
2. Set environment variables
3. Run: `pnpm start`

## Troubleshooting

### Login not working
- Check Firebase Authentication is enabled
- Verify `.env.local` has correct API keys
- Check browser console for error messages

### Products not saving
- Verify Firestore is created and initialized
- Check Firestore Rules allow write operations
- Ensure user has correct role

### Charts not displaying
- Check if sales data exists in Firestore
- Verify date range filter is set correctly
- Look for console errors

### Real-time updates not working
- Check browser console for Firebase errors
- Verify Firestore Rules allow read operations
- Ensure user is authenticated

## Future Enhancements

- Image uploads for products
- Damage/return tracking
- Automated reorder alerts
- Email notifications
- Export reports to PDF/Excel
- Barcode scanning
- Multi-location support
- API for third-party integrations

## Support & Documentation

- [Firebase Setup Guide](./FIREBASE_SETUP.md)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/)

## License

This project is proprietary software for Finbuy. All rights reserved.

## Contact

For questions or support regarding the Finbuy IMS, please contact the development team.

---

**Version**: 1.0.0 (MVP)  
**Last Updated**: February 10, 2024  
**Status**: Production Ready
