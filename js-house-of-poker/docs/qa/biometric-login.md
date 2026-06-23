# Biometric login QA checklist

Biometric login uses the platform biometric prompt on iOS and Android and stores only the signed-in session token in secure device storage. It does not store the user's raw password.

## Required native modules

Install and rebuild the Expo app with:

```sh
npx expo install expo-local-authentication expo-secure-store
```

Web builds should continue to use email/password or social login. The biometric button displays a friendly fallback message on web because browsers should use a WebAuthn/passkey flow rather than raw fingerprint access.

## Manual QA coverage

1. **Existing email/password login still works**
   - Sign in with a valid email and password.
   - Confirm the app reaches the home screen and the profile screen shows the authenticated account.
2. **Biometric opt-in flow**
   - After a successful email/password or Google login, accept the “Enable biometric login?” prompt.
   - Confirm the app reports biometric login as enabled under Profile → Security preferences.
3. **Successful biometric login**
   - Log out or relaunch the app.
   - Tap “Sign in with biometrics”.
   - Complete the OS fingerprint/face prompt and confirm the app signs in with the stored session token.
4. **Biometric unavailable/enrollment missing**
   - Test on a simulator/device with no biometric hardware or no enrolled fingerprint/face unlock.
   - Tap “Sign in with biometrics” and confirm the app keeps the email/password form available with a clear message.
5. **Failed or cancelled biometric prompt**
   - Tap “Sign in with biometrics” and cancel the OS prompt or fail matching.
   - Confirm the app shows a user-friendly fallback message and email/password login remains usable.
6. **Disable biometric login**
   - Open Profile → Security preferences and disable biometric login.
   - Return to the login screen and confirm biometric login asks the user to sign in with email/password before re-enabling.
