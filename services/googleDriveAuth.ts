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

// Flag to track sign-in progress
let isSigningIn = false;
// Cache access token strictly in memory
let cachedAccessToken: string | null = null;

export interface GoogleDriveUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
}

/**
 * Initialize Firebase Auth listener
 */
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Trigger Google Drive OAuth Popup Sign-In
 */
export const signInWithGoogleDrive = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Drive access token.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
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
 * Disconnect and sign out from Google Drive
 */
export const signOutGoogleDrive = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Check if Google Drive is currently connected with a valid token
 */
export const isGoogleDriveConnected = (): boolean => {
  return !!(auth.currentUser && cachedAccessToken);
};

/**
 * Get currently authenticated Google Drive user profile
 */
export const getGoogleDriveUser = (): GoogleDriveUser | null => {
  const u = auth.currentUser;
  if (!u) return null;
  return {
    uid: u.uid,
    displayName: u.displayName,
    email: u.email,
    photoURL: u.photoURL
  };
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
    throw new Error('Not authenticated with Google Drive. Please sign in first.');
  }

  const metadata: any = {
    name: fileName,
    mimeType: mimeType
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const blobData = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });

  // Construct multipart body
  const multipartBody = new Blob([
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    metadataBlob,
    delimiter,
    `Content-Type: ${mimeType}\r\n\r\n`,
    blobData,
    closeDelimiter
  ]);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,createdTime,modifiedTime,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: multipartBody
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive upload failed (${response.status}): ${errorText}`);
  }

  return await response.json();
};

/**
 * List files stored in Google Drive matching query
 */
export const listGoogleDriveFiles = async (
  searchTerm: string = 'AfAccounts'
): Promise<GoogleDriveFile[]> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google Drive.');
  }

  const query = `name contains '${searchTerm}' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,createdTime,modifiedTime,size)&orderBy=createdTime desc&pageSize=20`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list Google Drive files: ${errorText}`);
  }

  const data = await response.json();
  return data.files || [];
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
