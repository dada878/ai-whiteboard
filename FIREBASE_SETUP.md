# Firebase Setup Guide

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter your project name and follow the setup wizard

## 2. Enable Authentication

1. In Firebase Console, go to Authentication > Sign-in method
2. Enable the following providers:
   - Email/Password
   - Google
   - Anonymous

## 3. Get Your Configuration

1. Go to Project Settings (gear icon)
2. Under "Your apps", click "Add app" and select Web
3. Register your app with a nickname
4. Copy the Firebase configuration

## 4. Set Up Environment Variables

1. Copy `.env.local.example` to `.env.local`
2. Replace the placeholder values with your Firebase configuration:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your actual values:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your-actual-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

## 5. Configure Google Sign-In

1. In Firebase Console > Authentication > Sign-in method > Google
2. Click on Google provider and enable it
3. Add your domain to the authorized domains list

## 6. Security Rules (Optional)

If you plan to use Firestore for data storage, set up security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to read/write their projects
    match /projects/{projectId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
  }
}
```

## 7. Start the Application

```bash
npm run dev
```

Your application should now be ready with Firebase Authentication!