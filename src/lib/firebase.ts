import { initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";

// These values are not secrets. Firebase web config is public by design; access
// is controlled by Firestore rules and the callable functions.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, "us-central1");
const auth = getAuth(app);

if (import.meta.env.VITE_USE_EMULATOR === "true") {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
}

// Sign-in is Google-only. It doesn't decide *who* is allowed to use the app --
// anyone with a Google account can sign in here -- the Cloud Functions
// (requireOwner in functions/src/index.ts) are what actually reject every
// account except the one configured via ALLOWED_EMAIL.
const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle(): Promise<unknown> {
  return signInWithPopup(auth, googleProvider);
}

export function signOut(): Promise<void> {
  return firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export type Story = {
  title: string;
  summary: string;
  source: string;
  url: string;
  category:
    | "model-release"
    | "research"
    | "funding"
    | "product"
    | "policy"
    | "other";
  significance: number;
};

export type Tone = "professional" | "conversational" | "analytical";

export const getDigest = httpsCallable<
  { date?: string; refresh?: boolean },
  { date: string; cached: boolean; stories: Story[] }
>(functions, "getDigest");

export const createLinkedInPost = httpsCallable<
  { story: Story; tone: Tone },
  { id: string; content: string; tone: Tone }
>(functions, "createLinkedInPost");
