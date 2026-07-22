# Sample Data for Finbuy IMS

This guide provides sample data you can add to Firebase to test the Finbuy IMS application.

## How to Add Sample Data

### Option 1: Manual Entry via Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to your project
3. Go to **Firestore Database**
4. Click on collections and manually add documents

### Option 2: Use the Application UI

1. Start the application
2. Register as an Admin user
3. Go to `/dashboard/products`
4. Click "Add Product" and fill in the form

## Sample Home Appliances Products

### Product 1: Samsung 55" Smart TV
```json
{
  "name": "Samsung 55\" Smart 4K TV",
  "category": "home-appliances",
  "brand": "Samsung",
  "sku": "SAM-TV-55-001",
  "quantity": 8,
  "costPrice": 250000,
  "sellingPrice": 350000,
  "supplier": "Tech Suppliers Ltd",
  "dateAdded": "2024-02-01T10:00:00Z",
  "lastUpdated": "2024-02-01T10:00:00Z"
}
```

### Product 2: LG Refrigerator
```json
{
  "name": "LG Double Door Refrigerator",
  "category": "home-appliances",
  "brand": "LG",
  "sku": "LG-FRIDGE-450-001",
  "quantity": 5,
  "costPrice": 180000,
  "sellingPrice": 250000,
  "supplier": "Appliance World",
  "dateAdded": "2024-02-01T11:00:00Z",
  "lastUpdated": "2024-02-01T11:00:00Z"
}
```

### Product 3: Microwave Oven
```json
{
  "name": "Sharp Microwave Oven",
  "category": "home-appliances",
  "brand": "Sharp",
  "sku": "SHARP-MW-1200-001",
  "quantity": 12,
  "costPrice": 35000,
  "sellingPrice": 50000,
  "supplier": "Home Appliances Plus",
  "dateAdded": "2024-02-01T12:00:00Z",
  "lastUpdated": "2024-02-01T12:00:00Z"
}
```

### Product 4: Washing Machine
```json
{
  "name": "Bosch Automatic Washing Machine",
  "category": "home-appliances",
  "brand": "Bosch",
  "sku": "BOSCH-WM-8KG-001",
  "quantity": 3,
  "costPrice": 150000,
  "sellingPrice": 210000,
  "supplier": "Tech Suppliers Ltd",
  "dateAdded": "2024-02-01T13:00:00Z",
  "lastUpdated": "2024-02-01T13:00:00Z"
}
```

## Sample Sneakers Products

### Product 5: Nike Air Max
```json
{
  "name": "Nike Air Max 90",
  "category": "sneakers",
  "brand": "Nike",
  "sku": "NIKE-AM90-42-BLK",
  "quantity": 15,
  "costPrice": 45000,
  "sellingPrice": 65000,
  "supplier": "Sports World",
  "size": "42",
  "color": "Black",
  "dateAdded": "2024-02-02T10:00:00Z",
  "lastUpdated": "2024-02-02T10:00:00Z"
}
```

### Product 6: Adidas Ultra Boost
```json
{
  "name": "Adidas Ultra Boost 21",
  "category": "sneakers",
  "brand": "Adidas",
  "sku": "ADIDAS-UB21-43-WHITE",
  "quantity": 8,
  "costPrice": 55000,
  "sellingPrice": 75000,
  "supplier": "Premium Sports",
  "size": "43",
  "color": "White",
  "dateAdded": "2024-02-02T11:00:00Z",
  "lastUpdated": "2024-02-02T11:00:00Z"
}
```

### Product 7: Puma Running Shoes
```json
{
  "name": "Puma RS-X",
  "category": "sneakers",
  "brand": "Puma",
  "sku": "PUMA-RSX-41-RED",
  "quantity": 20,
  "costPrice": 35000,
  "sellingPrice": 50000,
  "supplier": "Sports World",
  "size": "41",
  "color": "Red",
  "dateAdded": "2024-02-02T12:00:00Z",
  "lastUpdated": "2024-02-02T12:00:00Z"
}
```

### Product 8: Jordan 1 Retro
```json
{
  "name": "Air Jordan 1 Retro High",
  "category": "sneakers",
  "brand": "Jordan",
  "sku": "JORDAN-1-44-BLACK",
  "quantity": 6,
  "costPrice": 70000,
  "sellingPrice": 100000,
  "supplier": "Premium Sports",
  "size": "44",
  "color": "Black",
  "dateAdded": "2024-02-02T13:00:00Z",
  "lastUpdated": "2024-02-02T13:00:00Z"
}
```

## Sample Sales Transactions

### Sale 1
```json
{
  "productId": "SAM-TV-55-001",
  "quantity": 1,
  "price": 350000,
  "totalAmount": 350000,
  "recordedBy": "John Doe",
  "recordedAt": "2024-02-05T14:30:00Z",
  "notes": "Cash payment"
}
```

### Sale 2
```json
{
  "productId": "NIKE-AM90-42-BLK",
  "quantity": 2,
  "price": 65000,
  "totalAmount": 130000,
  "recordedBy": "Jane Smith",
  "recordedAt": "2024-02-05T15:45:00Z",
  "notes": "Online order"
}
```

### Sale 3
```json
{
  "productId": "SHARP-MW-1200-001",
  "quantity": 3,
  "price": 50000,
  "totalAmount": 150000,
  "recordedBy": "John Doe",
  "recordedAt": "2024-02-06T10:15:00Z",
  "notes": "Bulk order"
}
```

## Test User Accounts

After registration, here are suggested test accounts to create:

### Admin User
- **Email**: admin@finbuy.com
- **Password**: Admin123!@
- **Name**: Admin User
- **Role**: Admin

### Sales Staff User
- **Email**: sales@finbuy.com
- **Password**: Sales123!@
- **Name**: Sales Staff
- **Role**: Sales

### Manager User
- **Email**: manager@finbuy.com
- **Password**: Manager123!@
- **Name**: Store Manager
- **Role**: Manager

## Testing Scenarios

### 1. Test Low Stock Alerts
- Add a product with quantity less than 10
- Go to `/dashboard/alerts`
- Should appear in the alerts list

### 2. Test Sales Recording
- Add a few products first
- Go to `/dashboard/sales`
- Select a product and record a sale
- Check `/dashboard/products` to see quantity decreased
- Check `/dashboard/reports` to see revenue increase

### 3. Test Role-Based Access
- Login as Sales Staff
- Try to access `/dashboard/users` (should not see link)
- Try to access `/dashboard/settings` (should not see link)
- All sales and product features should work

### 4. Test Analytics
- Record multiple sales from different products
- Go to `/dashboard/reports`
- Check revenue trend shows correct data
- Filter by different time ranges

### 5. Test Search & Filter
- Go to `/dashboard/products`
- Search by product name
- Filter by category
- Search by SKU or brand

## Resetting Test Data

To reset all data and start fresh:

1. Go to Firebase Console
2. Select your Firestore Database
3. For each collection (users, products, sales):
   - Click the three-dot menu
   - Click "Delete collection"
4. Confirm deletion
5. Collections will be recreated automatically when you add new data

## Performance Testing

### Load Testing
- Try adding 100+ products
- Record 50+ sales transactions
- Check performance on `/dashboard/reports`

### Real-time Sync Testing
- Open dashboard in two browser windows
- Add a product in one window
- Should appear in the other window automatically

## Common Issues with Sample Data

### Products not appearing
- Check Firestore Rules allow read operations
- Verify user is logged in
- Check product documents have all required fields

### Sales not updating quantity
- Ensure sales has correct productId
- Verify Firestore Rules allow write operations
- Check product quantity isn't already 0

### Reports showing no data
- Ensure sales documents have recordedAt timestamp
- Check time range filter isn't too restrictive
- Verify sales are within selected time period

---

**Note**: This sample data is for testing purposes only. For production use, seed data through your actual inventory system or manual entry process.
