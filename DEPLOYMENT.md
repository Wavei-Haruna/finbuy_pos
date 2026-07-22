# Deployment Guide - Finbuy IMS

Complete guide to deploy your Finbuy Inventory Management System to production.

## Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Firebase project created and tested
- [ ] Firestore Rules updated for production
- [ ] Authentication tested with multiple users
- [ ] All features working in development
- [ ] Sample data removed or backed up
- [ ] Security rules reviewed
- [ ] Custom domain configured (if applicable)

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel is the easiest and fastest way to deploy a Next.js application.

#### Prerequisites
- GitHub account with repository containing your code
- Vercel account (free)

#### Steps

1. **Push Code to GitHub**

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit - Finbuy IMS"

# Create a new repository on GitHub
# Then push to GitHub
git remote add origin https://github.com/yourusername/finbuy-ims.git
git branch -M main
git push -u origin main
```

2. **Connect to Vercel**

- Go to https://vercel.com/new
- Import your GitHub repository
- Vercel will detect Next.js automatically
- Click "Continue"

3. **Configure Environment Variables**

In Vercel Dashboard:
- Go to your project
- Settings → Environment Variables
- Add all variables from `.env.local`:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`

4. **Deploy**

- Click "Deploy"
- Wait for build to complete
- Your app is now live!

#### Automatic Deployments

After initial deployment:
- Every push to `main` branch auto-deploys
- Preview deployments for pull requests
- Rollback any version instantly

### Option 2: Self-Hosted (AWS, DigitalOcean, etc.)

For custom hosting solutions.

#### Prerequisites
- Server with Node.js 18+
- PostgreSQL or other database (Firebase handles this)
- Domain name
- SSH access to server

#### Steps

1. **Build the Project**

```bash
# Install dependencies
pnpm install

# Build for production
pnpm build

# Start production server
pnpm start
```

2. **Using PM2 for Process Management**

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start "pnpm start" --name "finbuy-ims"

# Enable auto-restart on reboot
pm2 startup
pm2 save
```

3. **Set Up Nginx Reverse Proxy**

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. **Enable HTTPS with Let's Encrypt**

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --nginx -d yourdomain.com

# Enable auto-renewal
sudo systemctl enable certbot.timer
```

### Option 3: Docker Deployment

For containerized deployments.

#### Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy application
COPY . .

# Build application
RUN pnpm build

# Expose port
EXPOSE 3000

# Start application
CMD ["pnpm", "start"]
```

#### Create docker-compose.yml

```yaml
version: '3.8'

services:
  finbuy-ims:
    build: .
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_FIREBASE_API_KEY: ${NEXT_PUBLIC_FIREBASE_API_KEY}
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: ${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}
      NEXT_PUBLIC_FIREBASE_APP_ID: ${NEXT_PUBLIC_FIREBASE_APP_ID}
    restart: always
```

#### Deploy with Docker

```bash
# Build image
docker-compose build

# Run container
docker-compose up -d
```

## Firebase Production Setup

### Update Firestore Rules

Replace test mode rules with production rules:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow read: if request.auth.uid != null && 
                     getAfter(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      allow write: if request.auth.uid == userId && 
                      request.resource.data.role == resource.data.role;
      allow write: if request.auth.uid != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Products collection
    match /products/{product=**} {
      allow read: if request.auth.uid != null;
      allow create, update, delete: if request.auth.uid != null && 
                                       get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'sales'];
    }
    
    // Sales collection
    match /sales/{sale=**} {
      allow read: if request.auth.uid != null;
      allow create: if request.auth.uid != null && 
                       get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'sales'];
      allow update, delete: if request.auth.uid != null && 
                               get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Enable Authentication Enforcement

1. Go to Firebase Console
2. Authentication → Settings
3. Enable "Email enumeration protection"
4. Set up email/password requirements

### Set Up Backups

1. Go to Firestore Database
2. Backups tab
3. Create backup schedule (daily recommended)

### Enable Monitoring

1. Go to Firebase Console
2. Monitoring tab
3. Set up alerts for:
   - High read/write operations
   - Authentication failures
   - Database errors

## Performance Optimization

### Enable Caching

In `.next/vercel.json`:
```json
{
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "functions": {
    "api/**": {
      "memory": 3008,
      "maxDuration": 60
    }
  }
}
```

### Optimize Images

Consider adding image optimization:
```typescript
// Use Next.js Image component
import Image from 'next/image';

export default function ProductImage() {
  return (
    <Image
      src="/product.jpg"
      alt="Product"
      width={400}
      height={300}
      priority
    />
  );
}
```

### Database Indexing

Create Firestore indexes for better performance:

1. Go to Firestore Database → Indexes
2. Create composite indexes for:
   - products by category and quantity
   - sales by product and date
   - users by role

## Security Best Practices

1. **HTTPS Only**: Always use HTTPS in production
2. **Environment Variables**: Keep sensitive keys secure
3. **Firestore Rules**: Implement strict security rules
4. **Rate Limiting**: Implement rate limiting on API routes
5. **Input Validation**: Validate all user inputs
6. **Regular Updates**: Keep dependencies updated
7. **Monitoring**: Set up error tracking (Sentry)
8. **Backups**: Regular database backups

## Monitoring & Logging

### Set Up Error Tracking

Using Sentry (optional):

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
});
```

### Monitor Performance

- Use Vercel Analytics (built-in)
- Monitor Firebase metrics
- Set up uptime monitoring
- Track error rates

## Scaling Considerations

### If Database Gets Too Large

1. Archive old sales records to backup
2. Implement pagination in product lists
3. Add caching for frequently accessed data
4. Consider data partitioning

### If Traffic Increases

1. Enable CDN caching
2. Optimize images and assets
3. Implement database indexing
4. Use read replicas if needed

## Post-Deployment

### 1. Verify Deployment

```bash
# Test main functionality
- Login/logout
- Add products
- Record sales
- View reports
- Check alerts
```

### 2. Monitor Logs

- Check application logs
- Monitor Firebase logs
- Review error messages
- Track user activity

### 3. Performance Check

- Monitor page load times
- Check database query performance
- Verify API response times
- Monitor server resources

### 4. Security Audit

- Test authentication flows
- Verify data access controls
- Check for SQL injection vulnerabilities
- Validate input sanitization

### 5. Setup Alerts

Configure notifications for:
- Deployment failures
- High error rates
- Database issues
- Authentication problems

## Rollback Plan

If something goes wrong:

### With Vercel
1. Go to Deployments
2. Click the previous version
3. Click "Promote to Production"

### With Self-Hosted
1. Revert code changes
2. Rebuild and restart
3. Or use PM2 restart: `pm2 restart finbuy-ims`

### With Docker
```bash
# Revert to previous image
docker-compose down
docker tag old-image:tag finbuy-ims:latest
docker-compose up -d
```

## Maintenance

### Regular Tasks

- **Weekly**: Check error logs
- **Weekly**: Monitor performance metrics
- **Monthly**: Update dependencies
- **Monthly**: Review security rules
- **Monthly**: Check backup status
- **Quarterly**: Full security audit

### Update Dependencies

```bash
# Check for updates
pnpm outdated

# Update packages
pnpm update

# Update security patches
pnpm audit fix
```

## Troubleshooting Deployment

### Build Fails
- Check Node version compatibility
- Verify all environment variables set
- Check for TypeScript errors
- Review build logs

### App Won't Start
- Check environment variables
- Verify Firebase connection
- Review error logs
- Check server resources

### Authentication Not Working
- Verify Firebase is accessible
- Check authentication rules
- Confirm email/password provider enabled
- Review browser console errors

### Database Connection Issues
- Verify Firebase project created
- Check Firestore exists
- Confirm database rules allow access
- Check network connectivity

## Support & Resources

- [Vercel Deployment Docs](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Firebase Production Setup](https://firebase.google.com/docs/firestore/best-practices)
- [Docker Documentation](https://docs.docker.com/)

---

**Deployment Status**: Ready for production

Choose Vercel for easiest deployment, or self-host for more control. Either way, your Finbuy IMS will be secure, fast, and scalable!
