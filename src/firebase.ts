import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged as firebaseOnAuthStateChanged } from 'firebase/auth';
import { getFirestore, onSnapshot, doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, addDoc, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { UserProfile, Lesson, CustomWord } from './types';

// Detect fallback mode
export const isFallbackMode = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes('remixed');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Cache for leaderboard listeners
const leaderboardListeners = new Set<(players: UserProfile[]) => void>();

// Auth listener logic
type AuthCallback = (user: any | null) => void;
const authListeners = new Set<AuthCallback>();
let currentAuthUser: any | null = null;

// Initialize Auth listener
firebaseOnAuthStateChanged(auth, (firebaseUser) => {
  if (firebaseUser) {
    currentAuthUser = {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName || 'Jugador',
      photoURL: firebaseUser.photoURL,
      email: firebaseUser.email,
    };
    notifyAuthListeners();
  } else {
    const saved = localStorage.getItem('local_user');
    if (saved) {
      currentAuthUser = JSON.parse(saved);
    } else {
      currentAuthUser = null;
    }
    notifyAuthListeners();
  }
});

function notifyAuthListeners() {
  authListeners.forEach(cb => cb(currentAuthUser));
}

export function onAuthStateChanged(authInstance: any, callback: AuthCallback) {
  authListeners.add(callback);
  // Callback immediately
  callback(currentAuthUser);
  return () => {
    authListeners.delete(callback);
  };
}

export const loginWithGoogle = async () => {
  if (isFallbackMode) {
    console.log("In fallback mode, Google login skipped");
    return;
  }
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Error logging in:", error);
  }
};

export const loginWithNickname = (name: string) => {
  const uid = 'local-' + Math.random().toString(36).substr(2, 9);
  const localUser = {
    uid,
    displayName: name,
    photoURL: null,
    isLocal: true
  };
  localStorage.setItem('local_user', JSON.stringify(localUser));
  currentAuthUser = localUser;
  notifyAuthListeners();
  
  // Initialize in offline leaderboard with 0 score
  addLocalScore(uid, name, 0);
};

export const logout = async () => {
  localStorage.removeItem('local_user');
  currentAuthUser = null;
  notifyAuthListeners();
  if (!isFallbackMode) {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out", error);
    }
  }
};

// --- Leaderboard & Score offline/online helpers ---

// Get local scores
function getLocalScores(): UserProfile[] {
  const scoresStr = localStorage.getItem('local_scores');
  if (!scoresStr) {
    // Seed with some neat initial rankings to make it feel alive!
    const defaultScores: UserProfile[] = [
      { uid: 'seed-1', name: 'Sofía Gómez', score: 120 },
      { uid: 'seed-2', name: 'Eduardo Ruiz', score: 90 },
      { uid: 'seed-3', name: 'Mateo Sanz', score: 70 },
      { uid: 'seed-4', name: 'León (IA)', score: 50 },
    ];
    localStorage.setItem('local_scores', JSON.stringify(defaultScores));
    return defaultScores;
  }
  try {
    return JSON.parse(scoresStr);
  } catch {
    return [];
  }
}

// Add local score
function addLocalScore(uid: string, name: string, scoreToAdd: number, won?: boolean, word?: string, timeSpent?: number): number {
  const scores = getLocalScores();
  const existingIndex = scores.findIndex(s => s.uid === uid);
  let finalScore = scoreToAdd;
  
  const currentStats = existingIndex !== -1 && scores[existingIndex].stats ? scores[existingIndex].stats : {
    gamesPlayed: 0,
    gamesWon: 0,
    totalTime: 0,
    wordsGuessed: [] as string[],
    achievements: [] as string[]
  };

  if (won !== undefined) {
    currentStats.gamesPlayed += 1;
    if (won) currentStats.gamesWon += 1;
    if (timeSpent) currentStats.totalTime += timeSpent;
    if (won && word && !currentStats.wordsGuessed.includes(word)) {
      currentStats.wordsGuessed.push(word);
    }
    
    // Check for new achievements
    if (currentStats.gamesWon >= 1 && !currentStats.achievements.includes('Primer Triunfo')) {
      currentStats.achievements.push('Primer Triunfo');
    }
    if (currentStats.gamesWon >= 5 && !currentStats.achievements.includes('Imparable')) {
      currentStats.achievements.push('Imparable');
    }
    if (currentStats.gamesWon >= 10 && !currentStats.achievements.includes('Maestro del Vocabulario')) {
      currentStats.achievements.push('Maestro del Vocabulario');
    }
    if (currentStats.wordsGuessed.length >= 20 && !currentStats.achievements.includes('Diccionario Andante')) {
      currentStats.achievements.push('Diccionario Andante');
    }
  }

  if (existingIndex !== -1) {
    scores[existingIndex].score += scoreToAdd;
    finalScore = scores[existingIndex].score;
    scores[existingIndex].stats = currentStats;
    if (name) {
      scores[existingIndex].name = name;
    }
  } else {
    scores.push({ uid, name: name || 'Jugador', score: scoreToAdd, stats: currentStats });
  }
  
  // Sort descending
  scores.sort((a, b) => b.score - a.score);
  localStorage.setItem('local_scores', JSON.stringify(scores));
  
  // Trigger leaderboard updates if any listeners are registered
  notifyLeaderboardListeners(scores);
  
  return finalScore;
}

function notifyLeaderboardListeners(scores: UserProfile[]) {
  leaderboardListeners.forEach(cb => cb(scores));
}

// Subscribe to leaderboard changes (dual mode)
export function subscribeLeaderboard(
  onUpdate: (players: UserProfile[]) => void,
  onError?: (err: any) => void
) {
  if (isFallbackMode) {
    leaderboardListeners.add(onUpdate);
    // Send immediate values
    onUpdate(getLocalScores());
    return () => {
      leaderboardListeners.delete(onUpdate);
    };
  }

  // Real Firestore path
  const q = query(collection(db, 'users'), orderBy('score', 'desc'), limit(50));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const data: UserProfile[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as UserProfile);
    });
    onUpdate(data);
  }, (error) => {
    console.warn("Firestore collection listen failed, falling back to local storage:", error);
    // Fall back to local
    leaderboardListeners.add(onUpdate);
    onUpdate(getLocalScores());
    if (onError) onError(error);
  });

  return unsubscribe;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (isFallbackMode || uid.startsWith('local-')) {
    const scores = getLocalScores();
    return scores.find(s => s.uid === uid) || null;
  }
  try {
    const docSnap = await getDoc(doc(db, 'users', uid));
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
  } catch (e) {
    console.error("Error getting user profile", e);
  }
  return null;
}

// Save user score (dual mode)
export async function saveUserScore(uid: string, name: string, points: number, won?: boolean, word?: string, timeSpent?: number): Promise<number> {
  if (isFallbackMode || uid.startsWith('local-')) {
    return addLocalScore(uid, name, points, won, word, timeSpent);
  }

  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    let newScore = points;
    let stats = {
      gamesPlayed: 0,
      gamesWon: 0,
      totalTime: 0,
      wordsGuessed: [] as string[],
      achievements: [] as string[]
    };

    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      newScore = (data.score || 0) + points;
      if (data.stats) {
        stats = { ...stats, ...data.stats };
      }
    }

    if (won !== undefined) {
      stats.gamesPlayed += 1;
      if (won) stats.gamesWon += 1;
      if (timeSpent) stats.totalTime += timeSpent;
      if (won && word && !stats.wordsGuessed.includes(word)) {
        stats.wordsGuessed.push(word);
      }
      
      if (stats.gamesWon >= 1 && !stats.achievements.includes('Primer Triunfo')) stats.achievements.push('Primer Triunfo');
      if (stats.gamesWon >= 5 && !stats.achievements.includes('Imparable')) stats.achievements.push('Imparable');
      if (stats.gamesWon >= 10 && !stats.achievements.includes('Maestro del Vocabulario')) stats.achievements.push('Maestro del Vocabulario');
      if (stats.wordsGuessed.length >= 20 && !stats.achievements.includes('Diccionario Andante')) stats.achievements.push('Diccionario Andante');
    }

    await setDoc(userRef, { uid, name, score: newScore, stats }, { merge: true });
    return newScore;
  } catch (error) {
    console.warn("Firestore save score failed, saving locally:", error);
    return addLocalScore(uid, name, points, won, word, timeSpent);
  }
}

// --- Lessons API ---
export async function getLessons(): Promise<Lesson[]> {
  if (isFallbackMode) {
    const raw = localStorage.getItem('local_lessons');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  try {
    const q = query(collection(db, 'lessons'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const lessons: Lesson[] = [];
    snap.forEach(doc => {
      lessons.push({ id: doc.id, ...doc.data() } as Lesson);
    });
    return lessons;
  } catch (error) {
    console.error("Error fetching lessons from Firestore", error);
    // fallback to local
    const raw = localStorage.getItem('local_lessons');
    return raw ? JSON.parse(raw) : [];
  }
}

export async function saveLesson(subject: string, title: string, words: CustomWord[], mode: string): Promise<Lesson> {
  const lessonData = {
    subject,
    title,
    words,
    mode,
    createdAt: Date.now()
  };

  if (isFallbackMode) {
    const lessonsStr = localStorage.getItem('local_lessons');
    const lessons: Lesson[] = lessonsStr ? JSON.parse(lessonsStr) : [];
    const newLesson: Lesson = { id: 'local-' + Math.random().toString(36).substr(2, 9), ...lessonData };
    lessons.push(newLesson);
    localStorage.setItem('local_lessons', JSON.stringify(lessons));
    return newLesson;
  }

  try {
    const docRef = await addDoc(collection(db, 'lessons'), lessonData);
    return { id: docRef.id, ...lessonData };
  } catch (error) {
    console.error("Error saving lesson to Firestore", error);
    // fallback
    const lessonsStr = localStorage.getItem('local_lessons');
    const lessons: Lesson[] = lessonsStr ? JSON.parse(lessonsStr) : [];
    const newLesson: Lesson = { id: 'local-' + Math.random().toString(36).substr(2, 9), ...lessonData };
    lessons.push(newLesson);
    localStorage.setItem('local_lessons', JSON.stringify(lessons));
    return newLesson;
  }
}

// Error boundary specific handler
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
