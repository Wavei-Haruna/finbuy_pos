# Firebase Setup Guide for Finbuy IMS

This guide will help you set up Firebase for the Finbuy Inventory Management System.

## Prerequisites

- A Google account
- Access to the project environment variables

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `finbuy-ims`
4. Accept the terms and click "Continue"
5. Disable Google Analytics (optional) and click "Create project"
6. Wait for the project to be created

## Step 2: Set Up Authentication

1. In the Firebase Console, go to **Authentication**
2. Click **Get Started**
3. Click on **Email/Password**
4. Enable it and click **Save**

## Step 3: Create a Firestore Database

1. In the Firebase Console, go to **Firestore Database**
2. Click **Create Database**
3. Choose **Start in test mode** (for development)
4. Select your preferred location and click **Create**

## Step 4: Get Your Firebase Credentials

1. In the Firebase Console, go to **Project Settings** (gear icon)
2. Click on **Your apps**
3. Click the web icon `</>` to add a web app
4. Enter app name: `finbuy-ims-web`
5. Click **Register app**
6. Copy the Firebase config object

## Step 5: Add Environment Variables

Add the following to your `.env.local` file with values from your Firebase config:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Step 6: Set Up Firestore Rules (Security)

In the Firebase Console, go to **Firestore Database** → **Rules** and replace with:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
      allow read: if request.auth.uid != null && resource.data.role == 'admin';
    }
    
    // Products - all authenticated users can read, admins/sales can write
    match /products/{document=**} {
      allow read: if request.auth.uid != null;
      allow write: if request.auth.uid != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'sales'];
    }
    
    // Sales - all authenticated users can read, admins/sales can write
    match /sales/{document=**} {
      allow read: if request.auth.uid != null;
      allow write: if request.auth.uid != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'sales'];
    }
    
    // Default deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Step 7: Database Collections Setup

Create the following collections in Firestore:

### 1. `users` Collection
Sample document structure:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "admin",
  "createdAt": "2024-02-10T00:00:00Z"
}
```

### 2. `products` Collection
Sample document structure:
```json
{
  "name": "Samsung 55\" Smart TV",
  "category": "home-appliances",
  "brand": "Samsung",
  "sku": "SAM-TV-55-001",
  "quantity": 15,
  "costPrice": 250000,
  "sellingPrice": 350000,
  "supplier": "Tech Suppliers Ltd",
  "size": null,
  "color": null,
  "dateAdded": "2024-02-10T00:00:00Z",
  "lastUpdated": "2024-02-10T00:00:00Z"
}
```

### 3. `sales` Collection
Sample document structure:
```json
{
  "productId": "product_doc_id",
  "quantity": 2,
  "price": 350000,
  "totalAmount": 700000,
  "recordedBy": "John Doe",
  "recordedAt": "2024-02-10T00:00:00Z",
  "notes": "Cash payment"
}
```

## Step 8: Test the Application

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open `http://localhost:3000` in your browser

3. You should be redirected to the login page

4. Click "Register here" to create a test account

5. Create an account with:
   - Name: Test Admin
   - Email: admin@test.com
   - Password: TestPassword123!
   - Role: Admin

6. After registration, you'll be logged in to the dashboard

## Troubleshooting

### "Firebase config is missing"
- Make sure all environment variables are set in `.env.local`
- Restart the development server after adding variables

### "Authentication not working"
- Check that Authentication is enabled in Firebase Console
- Verify Email/Password provider is active
- Check browser console for detailed error messages

### "Firestore write denied"
- Check your Firestore Rules
- Ensure your user document exists with the correct role
- Verify you're logged in with the correct account

## Production Deployment

Before deploying to production:

1. Update Firestore Rules to use production-safe settings
2. Enable authentication enforcement
3. Set up backups in Firebase Console
4. Review and enable additional security features
5. Update environment variables with production Firebase config

## Support

For issues or questions, refer to:
- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Finbuy Support](mailto:support@finbuy.com)
