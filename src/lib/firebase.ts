import { initializeApp } from "firebase/app";
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

if (import.meta.env.VITE_USE_EMULATOR === "true") {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
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
