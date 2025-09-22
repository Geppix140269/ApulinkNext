// src/config/firebase.ts
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

export { admin, db, auth, storage };

// Hybrid data manager
export class HybridDataManager {
  // Store structured data in PostgreSQL
  async storeStructuredData(data: any) {
    // This will use Prisma
    return data;
  }

  // Store unstructured data in Firebase
  async storeUnstructuredData(collection: string, data: any) {
    const docRef = await db.collection(collection).add({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  // Get hybrid data (combines both sources)
  async getHybridProjectData(projectId: string) {
    // Get structured data from PostgreSQL (via Prisma)
    // Get unstructured data from Firebase
    // Combine and return
    
    const firebaseData = await db.collection('projects').doc(projectId).get();
    
    return {
      firebase: firebaseData.data(),
      // postgresql data will come from Prisma
    };
  }
}