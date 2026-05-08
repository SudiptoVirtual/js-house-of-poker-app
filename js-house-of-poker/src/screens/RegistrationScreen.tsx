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
import { authenticateWithGoogle, registerUser } from '../services/api/auth';
import { getApiErrorDetails } from '../services/api/client';
import { saveAuthSession } from '../services/storage/sessionStorage';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Registration'>;

type RegistrationFieldErrors = {
  email?: string;
  name?: string;
  password?: string;
  phone?: string;
};

export function RegistrationScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function completeAuth(token: string, user: unknown) {
    await saveAuthSession({ token, user });
    navigation.reset({
      index: 0,
      routes: [{ name: routes.Home }],
    });
  }

  function clearError(field?: keyof RegistrationFieldErrors) {
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

  async function handleRegistration() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedContact = contact.trim();
    const digitsOnly = trimmedContact.replace(/\D/g, '');
    const nextFieldErrors: RegistrationFieldErrors = {};

    if (!trimmedName) {
      nextFieldErrors.name = 'Name is required.';
    }

    if (!trimmedEmail) {
      nextFieldErrors.email = 'Email is required.';
    } else if (!trimmedEmail.includes('@')) {
      nextFieldErrors.email = 'Use a valid email address.';
    }

    if (!trimmedContact) {
      nextFieldErrors.phone = 'Contact number is required.';
    } else if (digitsOnly.length < 7) {
      nextFieldErrors.phone = 'Enter a valid contact number.';
    }

    if (!password) {
      nextFieldErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      nextFieldErrors.password = 'Password must be at least 6 characters long.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setErrorMessage('');
      return;
    }

    clearError();
    setIsSubmitting(true);

    try {
      const response = await registerUser({
        email: trimmedEmail,
        name: trimmedName,
        password,
        phone: trimmedContact,
      });

      await completeAuth(response.token, response.user);
    } catch (error) {
      const details = getApiErrorDetails(error, 'Unable to create your account right now.');

      setErrorMessage(details.message);
      setFieldErrors({
        email: details.fieldErrors.email,
        name: details.fieldErrors.name,
        password: details.fieldErrors.password,
        phone: details.fieldErrors.phone,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen
      eyebrow="New player"
      title="Create a free-play account"
      subtitle={complianceCopy.authSummary}
    >
      <BrandPanel
        subtitle="Set up your player identity for free-play tables, social discovery, and private invites."
        title="Claim Your Seat"
      />

      <ComplianceNotice />

      <SectionCard title="Registration details">
        <AuthTextField
          autoCapitalize="words"
          autoComplete="name"
          autoCorrect={false}
          errorText={fieldErrors.name}
          label="Name"
          onChangeText={(value) => {
            setName(value);
            clearError('name');
          }}
          placeholder="Your full name"
          textContentType="name"
          value={name}
        />
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
          autoComplete="tel"
          errorText={fieldErrors.phone}
          keyboardType="phone-pad"
          label="Contact"
          onChangeText={(value) => {
            setContact(value);
            clearError('phone');
          }}
          placeholder="+1 555 010 8821"
          textContentType="telephoneNumber"
          value={contact}
        />
        <AuthTextField
          autoCapitalize="none"
          autoComplete="password"
          autoCorrect={false}
          errorText={fieldErrors.password}
          helperText="Use at least 6 characters."
          label="Password"
          onChangeText={(value) => {
            setPassword(value);
            clearError('password');
          }}
          placeholder="Create a password"
          secureTextEntry
          textContentType="newPassword"
          value={password}
        />
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <ActionButton
          label="Create account"
          loading={isSubmitting}
          onPress={() => void handleRegistration()}
        />
      </SectionCard>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with Google</Text>
        <View style={styles.dividerLine} />
      </View>

      <SectionCard title="Google sign up">
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
        <Text style={styles.metaText}>Already have an account?</Text>
        <Pressable disabled={isBusy} onPress={() => navigation.navigate(routes.Login)}>
          <Text style={styles.link}>Back to login</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 8,
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
