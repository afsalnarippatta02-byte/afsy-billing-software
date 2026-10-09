import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Configure Google Provider with Drive scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.appdata');
provider.setCustomParameters({ prompt: 'select_account' });

// Flag to track sign-in progress
let isSigningIn = false;
// Cache access token strictly in memory (never in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

const LINKED_DRIVE_PROFILE_KEY = 'af_linked_drive_profile';
const LINKED_DRIVE_EMAIL_KEY = 'af_linked_drive_account';

export interface GoogleDriveUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  authMode?: 'oauth' | 'email-verified';
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  invoiceCount?: number;
  clientCount?: number;
  isMasterMirror?: boolean;
  source?: 'google-drive-api' | 'cloud-vault';
}

type AuthSubscriber = {
  onSuccess?: (user: GoogleDriveUser, token: string) => void;
  onFailure?: () => void;
};

const authSubscribers = new Set<AuthSubscriber>();

function saveLinkedProfileMetadata(profile: GoogleDriveUser | null) {
  try {
    if (profile && profile.email) {
      const cleanEmail = profile.email.toLowerCase().trim();
      localStorage.setItem(
        LINKED_DRIVE_PROFILE_KEY,
        JSON.stringify({
          uid: profile.uid || ` usr_${cleanEmail}`,
          displayName: profile.displayName || cleanEmail.split('@')[0],
          email: cleanEmail,
          photoURL: profile.photoURL || null,
          authMode: profile.authMode || 'oauth',
        })
      );
      localStorage.setItem(LINKED_DRIVE_EMAIL_KEY, cleanEmail);
    } else {
      localStorage.removeItem(LINKED_DRIVE_PROFILE_KEY);
      localStorage.removeItem(LINKED_DRIVE_EMAIL_KEY);
    }
  } catch (e) {
    console.warn('Could not persist linked Drive profile metadata:', e);
  }
}

function loadLinkedProfileMetadata(): GoogleDriveUser | null {
  try {
    const raw = localStorage.getItem(LINKED_DRIVE_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.email && !parsed.email.toLowerCase().includes('afsalnarippatta')) {
        return parsed;
      }
    }
    const fallbackEmail = localStorage.getItem(LINKED_DRIVE_EMAIL_KEY);
    if (fallbackEmail && !fallbackEmail.toLowerCase().includes('afsalnarippatta')) {
      const clean = fallbackEmail.toLowerCase().trim();
      return {
        uid: `email_${clean}`,
        displayName: clean.split('@')[0],
        email: clean,
        photoURL: null,
        authMode: 'email-verified',
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function notifyAuthSubscribers() {
  const currentUser = getGoogleDriveUser();
  const connected = isGoogleDriveConnected();
  authSubscribers.forEach(sub => {
    if (connected && currentUser) {
      if (sub.onSuccess) sub.onSuccess(currentUser, cachedAccessToken || 'cloud-vault-linked');
    } else {
      if (sub.onFailure) sub.onFailure();
    }
  });
}

// Listen to Firebase Auth state changes globally to clear cachedAccessToken when signed out
onAuthStateChanged(auth, (user: User | null) => {
  if (user) {
    if (user.email) {
      saveLinkedProfileMetadata({
        uid: user.uid,
        displayName: user.displayName || user.email.split('@')[0],
        email: user.email,
        photoURL: user.photoURL,
        authMode: cachedAccessToken ? 'oauth' : 'email-verified',
      });
    }
    if (!isSigningIn) {
      notifyAuthSubscribers();
    }
  } else {
    // Clear in-memory OAuth token when Firebase signs out
    cachedAccessToken = null;
    if (!isSigningIn) {
      notifyAuthSubscribers();
    }
  }
});

/**
 * Initialize Firebase & Google Drive Auth listener
 */
export const initGoogleAuth = (
  onAuthSuccess?: (user: GoogleDriveUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  const subscriber: AuthSubscriber = { onSuccess: onAuthSuccess, onFailure: onAuthFailure };
  authSubscribers.add(subscriber);

  // Immediately invoke with current state
  const currentUser = getGoogleDriveUser();
  if (isGoogleDriveConnected() && currentUser) {
    if (onAuthSuccess) onAuthSuccess(currentUser, cachedAccessToken || 'cloud-vault-linked');
  } else {
    if (onAuthFailure) onAuthFailure();
  }

  return () => {
    authSubscribers.delete(subscriber);
  };
};

/**
 * Link Google Drive account via verified email (works alongside OAuth or when popup is blocked in iframe)
 */
export const linkGoogleDriveAccountByEmail = (
  email: string,
  displayName?: string | null
): GoogleDriveUser => {
  const cleanEmail = email.toLowerCase().trim();
  const profile: GoogleDriveUser = {
    uid: auth.currentUser?.uid || `email_${cleanEmail}`,
    displayName: displayName || auth.currentUser?.displayName || cleanEmail.split('@')[0],
    email: cleanEmail,
    photoURL: auth.currentUser?.photoURL || null,
    authMode: cachedAccessToken ? 'oauth' : 'email-verified',
  };
  saveLinkedProfileMetadata(profile);
  notifyAuthSubscribers();
  return profile;
};

/**
 * Trigger Google Drive OAuth Popup Sign-In
 */
export const signInWithGoogleDrive = async (): Promise<{ user: GoogleDriveUser; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Drive access token from popup.');
    }

    cachedAccessToken = credential.accessToken;
    const driveUser: GoogleDriveUser = {
      uid: result.user.uid,
      displayName: result.user.displayName || (result.user.email ? result.user.email.split('@')[0] : 'Google User'),
      email: result.user.email,
      photoURL: result.user.photoURL,
      authMode: 'oauth',
    };
    saveLinkedProfileMetadata(driveUser);
    notifyAuthSubscribers();

    return { user: driveUser, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Drive sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current in-memory access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Check if direct OAuth Bearer token is currently active in memory
 */
export const hasActiveGoogleOAuthToken = (): boolean => {
  return !!(auth.currentUser && cachedAccessToken);
};

/**
 * Disconnect and sign out from Google Drive
 */
export const signOutGoogleDrive = async (): Promise<void> => {
  cachedAccessToken = null;
  saveLinkedProfileMetadata(null);
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Firebase signOut warning:', e);
  }
  notifyAuthSubscribers();
};

/**
 * Check if Google Drive is currently connected (via OAuth session or linked Google Drive account)
 */
export const isGoogleDriveConnected = (): boolean => {
  if (auth.currentUser && (cachedAccessToken || auth.currentUser.email)) {
    return true;
  }
  const linked = loadLinkedProfileMetadata();
  return !!(linked && linked.email);
};

/**
 * Get currently authenticated or linked Google Drive user profile
 */
export const getGoogleDriveUser = (): GoogleDriveUser | null => {
  const u = auth.currentUser;
  if (u && u.email) {
    return {
      uid: u.uid,
      displayName: u.displayName || u.email.split('@')[0],
      email: u.email,
      photoURL: u.photoURL,
      authMode: cachedAccessToken ? 'oauth' : 'email-verified',
    };
  }
  return loadLinkedProfileMetadata();
};

/**
 * Helper to upload JSON or Blob data directly to Google Drive via v3 REST API
 */
export const uploadFileToGoogleDrive = async (
  fileName: string,
  mimeType: string,
  content: Blob | string,
  folderId?: string
): Promise<GoogleDriveFile> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('No active Google OAuth token in memory.');
  }

  const metadata: any = {
    name: fileName,
    mimeType: mimeType,
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const blobData = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' });

  // Construct multipart/related body with explicit Content-Type header
  const multipartBody = new Blob(
    [
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      metadataBlob,
      delimiter,
      `Content-Type: ${mimeType}\r\n\r\n`,
      blobData,
      closeDelimiter,
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,createdTime,modifiedTime,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive upload failed (${response.status}): ${errorText}`);
  }

  const uploaded = await response.json();
  return { ...uploaded, source: 'google-drive-api' };
};

/**
 * Update an existing file in Google Drive by fileId
 */
export const updateFileInGoogleDrive = async (
  fileId: string,
  fileName: string,
  mimeType: string,
  content: Blob | string
): Promise<GoogleDriveFile> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('No active Google OAuth token in memory.');
  }

  const metadata: any = {
    name: fileName,
    mimeType: mimeType,
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const blobData = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' });

  const multipartBody = new Blob(
    [
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      metadataBlob,
      delimiter,
      `Content-Type: ${mimeType}\r\n\r\n`,
      blobData,
      closeDelimiter,
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,mimeType,createdTime,modifiedTime,size`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive update failed (${response.status}): ${errorText}`);
  }

  const updated = await response.json();
  return { ...updated, source: 'google-drive-api' };
};

/**
 * List files stored in Google Drive matching query
 */
export const listGoogleDriveFiles = async (
  searchTerm: string = 'AfAccounts'
): Promise<GoogleDriveFile[]> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('No active Google OAuth token in memory.');
  }

  const safeTerm = searchTerm.replace(/'/g, "\\'");
  const query = `name contains '${safeTerm}' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,createdTime,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=25`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list Google Drive files: ${errorText}`);
  }

  const data = await response.json();
  return (data.files || []).map((f: any) => ({ ...f, source: 'google-drive-api' }));
};

/**
 * Download a file's content from Google Drive by fileId
 */
export const downloadGoogleDriveFileContent = async (fileId: string): Promise<string> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google Drive.');
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to download Google Drive file: ${errorText}`);
  }

  return await response.text();
};

/**
 * Delete a file from Google Drive
 */
export const deleteGoogleDriveFile = async (fileId: string): Promise<void> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google Drive.');
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete Google Drive file: ${errorText}`);
  }
};
