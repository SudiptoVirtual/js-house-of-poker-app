import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { env } from '../config/env';
import { getApiErrorDetails } from '../services/api/client';
import {
  exchangeGoogleIdTokenForFirebaseToken,
  getFirebaseAuthErrorMessage,
  getMissingFirebaseClientConfig,
} from '../services/firebase/client';

WebBrowser.maybeCompleteAuthSession();

type GoogleClientEnvName =
  | 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'
  | 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'
  | 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID';

type UseGoogleAuthOptions = {
  onAuthenticated: (idToken: string) => Promise<void> | void;
  onError: (message: string) => void;
};

export function useGoogleAuth({ onAuthenticated, onError }: UseGoogleAuthOptions) {
  const onAuthenticatedRef = useRef(onAuthenticated);
  const onErrorRef = useRef(onError);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated;
  }, [onAuthenticated]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const sharedClientId = env.googleAuth.webClientId;
  const platformClientId =
    Platform.OS === 'android'
      ? env.googleAuth.androidClientId || sharedClientId
      : Platform.OS === 'ios'
        ? env.googleAuth.iosClientId || sharedClientId
        : sharedClientId;

  const missingGoogleClientConfig = useMemo(() => {
    const missing: GoogleClientEnvName[] = [];

    if (!sharedClientId) {
      missing.push('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
    }

    if (Platform.OS === 'android' && !env.googleAuth.androidClientId && !sharedClientId) {
      missing.push('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID');
    }

    if (Platform.OS === 'ios' && !env.googleAuth.iosClientId && !sharedClientId) {
      missing.push('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
    }

    return missing;
  }, [sharedClientId]);

  const missingFirebaseConfig = useMemo(() => getMissingFirebaseClientConfig(), []);

  const redirectUri = useMemo(
    () =>
      makeRedirectUri({
        path: env.googleRedirectPath,
        scheme: env.googleRedirectScheme,
      }),
    [],
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: env.googleAuth.androidClientId || undefined,
    clientId: platformClientId || 'missing-google-client-id',
    iosClientId: env.googleAuth.iosClientId || undefined,
    redirectUri,
    selectAccount: true,
    scopes: ['openid', 'profile', 'email'],
    webClientId: env.googleAuth.webClientId || undefined,
  });

  useEffect(() => {
    if (!response) {
      return;
    }

    if (response.type !== 'success') {
      setIsLoading(false);

      if (response.type === 'error') {
        onErrorRef.current(response.error?.message ?? 'Google sign-in failed.');
      }

      return;
    }

    const idToken = response.authentication?.idToken ?? response.params.id_token;

    if (!idToken) {
      setIsLoading(false);
      onErrorRef.current('Google sign-in did not return an ID token.');
      return;
    }

    let isMounted = true;

    void (async () => {
      try {
        const firebaseIdToken = await exchangeGoogleIdTokenForFirebaseToken(idToken);
        await onAuthenticatedRef.current(firebaseIdToken);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const details = getApiErrorDetails(error, 'Unable to continue with Google right now.');
        const message = getFirebaseAuthErrorMessage(error, details.message);
        onErrorRef.current(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [response]);

  async function beginGoogleAuth() {
    const missingConfig = [...missingGoogleClientConfig, ...missingFirebaseConfig];

    if (missingConfig.length > 0) {
      onErrorRef.current(`Google sign-in is not configured yet. Missing: ${missingConfig.join(', ')}`);
      return;
    }

    if (!request) {
      onErrorRef.current('Google sign-in is still initializing. Please try again.');
      return;
    }

    setIsLoading(true);

    try {
      await promptAsync();
    } catch (error) {
      setIsLoading(false);
      const details = getApiErrorDetails(error, 'Google sign-in failed.');
      onErrorRef.current(details.message);
    }
  }

  return {
    beginGoogleAuth,
    isLoading,
  };
}
