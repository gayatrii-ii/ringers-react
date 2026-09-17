import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

type RoleType = 'customer' | 'vendor' | 'delivery';

interface RoleConfig {
  badge: string;
  badgeBg: string;
  badgeText: string;
  placeholder: string;
}

const ROLE_DETAILS: Record<RoleType, RoleConfig> = {
  customer: {
    badge: 'CUSTOMER RECOVERY',
    badgeBg: '#EFF6FF',
    badgeText: '#1D4ED8',
    placeholder: 'Enter registered mobile or username',
  },
  vendor: {
    badge: 'MERCHANT RECOVERY',
    badgeBg: '#FFF7ED',
    badgeText: '#C2410C',
    placeholder: 'Enter registered phone or vendor ID',
  },
  delivery: {
    badge: 'FLEET RECOVERY',
    badgeBg: '#F0FDF4',
    badgeText: '#15803D',
    placeholder: 'Enter registered phone or rider ID',
  },
};

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string; identifier?: string }>();

  const role: RoleType =
    params.role === 'vendor' || params.role === 'delivery'
      ? params.role
      : 'customer';

  const roleConfig = ROLE_DETAILS[role];

  const [identifier, setIdentifier] = useState(params.identifier || '');
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleBackToLogin = () => {
    router.push({
      pathname: '/(auth)/login',
      params: {
        role,
        ...(identifier.trim() ? { identifier: identifier.trim() } : {}),
      },
    });
  };

  const handleSendOtp = () => {
    if (!identifier.trim()) {
      setError('Please enter your mobile number or user ID.');
      return;
    }

    setError('');

    // Frontend validation successful -> Navigate to OTP screen with route parameters (No backend/API request)
    router.push({
      pathname: '/(auth)/otp',
      params: {
        role,
        identifier: identifier.trim(),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Decorative Ambient Shapes */}
      <View pointerEvents="none" style={styles.backgroundDecorations}>
        <View style={styles.decorBlobTop} />
        <View style={styles.decorBlobBottom} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentContainer}>
            {/* Top Bar Navigation */}
            <View style={styles.topBar}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleBackToLogin}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Back to Login"
              >
                <Text style={styles.backButtonIcon}>←</Text>
                <Text style={styles.backButtonText}>Back to Login</Text>
              </TouchableOpacity>

              <View
                style={[
                  styles.roleBadgeContainer,
                  { backgroundColor: roleConfig.badgeBg },
                ]}
              >
                <Text
                  style={[
                    styles.roleBadgeText,
                    { color: roleConfig.badgeText },
                  ]}
                >
                  {roleConfig.badge}
                </Text>
              </View>
            </View>

            {/* Brand Header */}
            <View style={styles.brandHeader}>
              <View style={styles.brandBadgeRow}>
                <View style={styles.brandIconContainer}>
                  <Text style={styles.brandIcon}>🔔</Text>
                </View>
                <View style={styles.brandTextContainer}>
                  <Text style={styles.brandName}>RINGERS</Text>
                  <Text style={styles.brandTagline}>HYPERLOCAL PLATFORM</Text>
                </View>
              </View>
              <Text style={styles.brandPill}>Everything local, closer to you.</Text>
            </View>

            {/* Hero Section */}
            <View style={styles.heroSection}>
              <Text style={styles.heroTitle}>Reset your password</Text>
              <Text style={styles.heroSubtitle}>
                No worries. Enter your registered mobile number or User ID and we&apos;ll help you get back into your account.
              </Text>
            </View>

            {/* Recovery Card */}
            <View style={styles.recoveryCard}>
              <Text style={styles.cardHeaderTitle}>Account recovery</Text>

              {/* Identifier Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mobile Number or User ID</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    isFocused && styles.inputWrapperFocused,
                    Boolean(error) && styles.inputWrapperError,
                  ]}
                >
                  <Text style={styles.leadingIcon}>📱</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder={roleConfig.placeholder}
                    placeholderTextColor="#94A3B8"
                    value={identifier}
                    onChangeText={(val) => {
                      setIdentifier(val);
                      if (error) setError('');
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>

              {/* Send OTP Primary Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSendOtp}
                disabled={!identifier.trim()}
                style={[
                  styles.sendButton,
                  !identifier.trim() && styles.sendButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Send OTP"
              >
                <Text
                  style={[
                    styles.sendButtonText,
                    !identifier.trim() && styles.sendButtonTextDisabled,
                  ]}
                >
                  Send OTP →
                </Text>
              </TouchableOpacity>

              {/* Return to Sign In Message */}
              <View style={styles.returnSection}>
                <Text style={styles.returnPrompt}>Remember your password? </Text>
                <TouchableOpacity
                  onPress={handleBackToLogin}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Back to Sign In"
                >
                  <Text style={styles.returnLink}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Trust Badge */}
            <View style={styles.trustArea}>
              <Text style={styles.trustText}>
                🔒 Account verification codes expire after a single use.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  backgroundDecorations: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  decorBlobTop: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#E0E7FF',
    opacity: 0.45,
  },
  decorBlobBottom: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#DBEAFE',
    opacity: 0.5,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 10,
  },
  backButtonIcon: {
    fontSize: 17,
    color: '#2563EB',
    fontWeight: '700',
    marginRight: 6,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  roleBadgeContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  brandIcon: {
    fontSize: 20,
  },
  brandTextContainer: {
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#0F172A',
  },
  brandTagline: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#2563EB',
    marginTop: 1,
  },
  brandPill: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 3.5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  recoveryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 7,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 48,
  },
  inputWrapperFocused: {
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
  },
  inputWrapperError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  leadingIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#0F172A',
    paddingVertical: 0,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
    marginLeft: 2,
    fontWeight: '500',
  },
  sendButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E1',
    ...Platform.select({
      ios: {
        shadowOpacity: 0,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  sendButtonTextDisabled: {
    color: '#94A3B8',
  },
  returnSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  returnPrompt: {
    fontSize: 13,
    color: '#64748B',
  },
  returnLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  trustArea: {
    marginTop: 20,
    alignItems: 'center',
  },
  trustText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
});
