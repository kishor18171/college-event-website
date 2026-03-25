
# Firebase Setup Instructions

I have updated your application to use **Firebase** as the database. This allows it to work perfectly on **Netlify**.

## Step 1: Create a Firebase Project
1.  Go to [Firebase Console](https://console.firebase.google.com/).
2.  Click **Add project** and follow the steps (name it "CollegeEvents" or similar).
3.  Disable Google Analytics (not needed for this).

## Step 2: Get Configuration
1.  In your new project dashboard, click the **Web icon** `</>` (under "Get started by adding Firebase to your app").
2.  Register the app (give it a nickname).
3.  You will see a code block with `const firebaseConfig = { ... }`.
4.  **COPY** just the content inside the `{ ... }` brackets (apiKey, authDomain, etc.).

## Step 3: Update Code
1.  Open the file `firebase-config.js` in your project folder.
2.  Replace the placeholder values with the keys you copied.

## Step 4: Create Firestore Database
1.  In Firebase Console, go to **Build > Firestore Database**.
2.  Click **Create Database**.
3.  Choose **Start in test mode** logic (this allows read/write access for development).
4.  Select a location close to you.

## Step 5: Deploy to Netlify
1.  Go to [Netlify](https://app.netlify.com/).
2.  Drag and drop your `code.mk` folder into the "Sites" area.
3.  Your app is live!
