import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import { AuthTextField } from '../components/AuthTextField';
import { BrandPanel } from '../components/BrandPanel';
import { ComplianceNotice } from '../components/ComplianceNotice';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { complianceCopy } from '../constants/compliance';
import { SocialAuthButton } from '../components/SocialAuthButton';
import { routes } from '../constants/routes';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { authenticateWithGoogle, loginUser } from '../services/api/auth';
import { getApiErrorDetails } from '../services/api/client';
import { saveAuthSession } from '../services/storage/sessionStorage';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

type LoginFieldErrors = {
  email?: string;
  password?: string;
};

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function completeAuth(token: string, user: unknown) {
    await saveAuthSession({ token, user });
    navigation.reset({
      index: 0,
      routes: [{ name: routes.Home }],
    });
  }

  function clearError(field?: keyof LoginFieldErrors) {
    setErrorMessage('');

    if (field) {
      setFieldErrors((current) => ({
        ...current,
        [field]: undefined,
      }));
      return;
    }

    setFieldErrors({});
  }

  const { beginGoogleAuth, isLoading: isGoogleLoading } = useGoogleAuth({
    onAuthenticated: async (firebaseIdToken) => {
      const response = await authenticateWithGoogle(firebaseIdToken);
      await completeAuth(response.token, response.user);
    },
    onError: (message) => {
      setErrorMessage(message);
    },
  });

  const isBusy = isSubmitting || isGoogleLoading;

  async function handleLogin() {
    const trimmedEmail = email.trim();
    const nextFieldErrors: LoginFieldErrors = {};

    if (!trimmedEmail) {
      nextFieldErrors.email = 'Email is required.';
    } else if (!trimmedEmail.includes('@')) {
      nextFieldErrors.email = 'Use a valid email address.';
    }

    if (!password) {
      nextFieldErrors.password = 'Password is required.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setErrorMessage('');
      return;
    }

    clearError();
    setIsSubmitting(true);

    try {
      const response = await loginUser({
        email: trimmedEmail,
        password,
      });

      await completeAuth(response.token, response.user);
    } catch (error) {
      const details = getApiErrorDetails(error, 'Unable to login right now.');

      setErrorMessage(details.message);
      setFieldErrors({
        email: details.fieldErrors.email,
        password: details.fieldErrors.password,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen
      eyebrow="Welcome back"
      title="Log in to free-play tables"
      subtitle={complianceCopy.authSummary}
    >
      <BrandPanel
        subtitle="Use your account to reach the lobby, social feed, and private free-play tables."
        title="Deal Yourself In"
      />

      <ComplianceNotice />

      <SectionCard title="Email login">
        <AuthTextField
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          errorText={fieldErrors.email}
          keyboardType="email-address"
          label="Email"
          onChangeText={(value) => {
            setEmail(value);
            clearError('email');
          }}
          placeholder="you@example.com"
          textContentType="emailAddress"
          value={email}
        />
        <AuthTextField
          autoCapitalize="none"
          autoComplete="password"
          autoCorrect={false}
          errorText={fieldErrors.password}
          label="Password"
          onChangeText={(value) => {
            setPassword(value);
            clearError('password');
          }}
          placeholder="Enter your password"
          secureTextEntry
          textContentType="password"
          value={password}
        />
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <ActionButton label="Login" loading={isSubmitting} onPress={() => void handleLogin()} />
      </SectionCard>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with Google</Text>
        <View style={styles.dividerLine} />
      </View>

      <SectionCard title="Google login">
        <View style={styles.socialRow}>
          <SocialAuthButton
            disabled={isBusy}
            loading={isGoogleLoading}
            onPress={() => {
              clearError();
              void beginGoogleAuth();
            }}
            provider="google"
          />
        </View>
      </SectionCard>

      <View style={styles.actions}>
        <Text style={styles.metaText}>New to House of Poker?</Text>
        <Pressable disabled={isBusy} onPress={() => navigation.navigate(routes.Registration)}>
          <Text style={styles.link}>Create an account</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 50,
  },
  dividerLine: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  dividerText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  link: {
    color: colors.secondary,
    fontSize: 16,
    fontWeight: '700',
  },
  metaText: {
    color: colors.mutedText,
    fontSize: 14,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
});
