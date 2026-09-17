import React, { useState, useEffect, useRef } from 'react';
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
  name: string;
  badge: string;
  badgeBg: string;
  badgeText: string;
  successMessage: string;
}

const ROLE_LABELS: Record<RoleType, RoleConfig> = {
  customer: {
    name: 'Customer',
    badge: 'CUSTOMER VERIFICATION',
    badgeBg: '#EFF6FF',
    badgeText: '#1D4ED8',
    successMessage: "Welcome to Ringers! You're ready to discover local stores and order essentials.",
  },
  vendor: {
    name: 'Vendor',
    badge: 'MERCHANT VERIFICATION',
    badgeBg: '#FFF7ED',
    badgeText: '#C2410C',
    successMessage: 'Welcome to Ringers! Your vendor portal is ready for your products and orders.',
  },
  delivery: {
    name: 'Delivery Partner',
    badge: 'FLEET VERIFICATION',
    badgeBg: '#F0FDF4',
    badgeText: '#15803D',
    successMessage: 'Welcome to Ringers! Your fleet profile is verified for upcoming deliveries.',
  },
};

export default function OtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string; identifier?: string }>();

  const role: RoleType =
    params.role === 'vendor' || params.role === 'delivery'
      ? params.role
      : 'customer';

  const identifier = params.identifier || 'User';
  const roleConfig = ROLE_LABELS[role];

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [resendNotice, setResendNotice] = useState('');

  const inputRef = useRef<TextInput>(null);

  // 30-second countdown for Resend OTP
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleBackToLogin = () => {
    router.push({
      pathname: '/(auth)/login',
      params: { role, identifier },
    });
  };

  const handleResendOtp = () => {
    if (!canResend) return;
    setTimer(30);
    setCanResend(false);
    setOtp('');
    setError('');
    setIsSuccess(false);
    setResendNotice('A new 6-digit code has been sent.');
    setTimeout(() => {
      setResendNotice('');
    }, 4000);
  };

  const handleVerifyOtp = () => {
    if (!otp) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }

    if (otp.length < 6) {
      setError('OTP must contain exactly 6 digits.');
      return;
    }

    setError('');
    // Frontend demo success state (no API/backend calls)
    setIsSuccess(true);
  };

  const handleContinueToRingers = () => {
    router.replace('/(auth)/role-selection');
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
              <Text style={styles.heroTitle}>Verify it&apos;s you</Text>
              <Text style={styles.heroSubtitle}>
                We&apos;ve sent a 6-digit verification code to
              </Text>
              {/* Highlighted identifier pill */}
              <View style={styles.identifierPill}>
                <Text style={styles.identifierText}>{identifier}</Text>
                <TouchableOpacity
                  onPress={handleBackToLogin}
                  activeOpacity={0.7}
                  style={styles.editLink}
                  accessibilityRole="button"
                  accessibilityLabel="Edit Identifier"
                >
                  <Text style={styles.editLinkText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Success State Card */}
            {isSuccess ? (
              <View style={styles.successCard}>
                <View style={styles.successIconCircle}>
                  <Text style={styles.successCheckIcon}>✓</Text>
                </View>
                <Text style={styles.successTitle}>Verification successful!</Text>
                <Text style={styles.successMessage}>
                  {roleConfig.successMessage}
                </Text>
                <View style={styles.demoNoticeBadge}>
                  <Text style={styles.demoNoticeText}>
                    DEMO MODE • Verification Complete
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleContinueToRingers}
                  style={styles.continueRingersButton}
                  accessibilityRole="button"
                  accessibilityLabel="Continue to Ringers"
                >
                  <Text style={styles.continueRingersText}>
                    Continue to Ringers →
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* OTP Form Card */
              <View style={styles.otpCard}>
                <Text style={styles.cardHeaderTitle}>
                  Enter verification code
                </Text>

                {/* 6-Digit OTP Box Grid */}
                <View style={styles.otpInputContainer}>
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => inputRef.current?.focus()}
                    style={styles.otpBoxesRow}
                  >
                    {[0, 1, 2, 3, 4, 5].map((index) => {
                      const digit = otp[index] || '';
                      const isFocused = otp.length === index;
                      return (
                        <View
                          key={index}
                          style={[
                            styles.otpBox,
                            isFocused && styles.otpBoxFocused,
                            Boolean(error) && styles.otpBoxError,
                          ]}
                        >
                          <Text style={styles.otpDigit}>{digit}</Text>
                        </View>
                      );
                    })}
                  </TouchableOpacity>

                  {/* Invisible input overlay that handles typing */}
                  <TextInput
                    ref={inputRef}
                    value={otp}
                    onChangeText={(val) => {
                      const clean = val.replace(/[^0-9]/g, '').slice(0, 6);
                      setOtp(clean);
                      if (error) setError('');
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={styles.hiddenInput}
                    autoFocus
                  />
                </View>

                {/* Validation Error Message */}
                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {/* Resend Notice Message */}
                {resendNotice ? (
                  <Text style={styles.resendNoticeText}>{resendNotice}</Text>
                ) : null}

                {/* Resend Section */}
                <View style={styles.resendSection}>
                  <Text style={styles.resendPrompt}>
                    Didn&apos;t receive the code?{' '}
                  </Text>
                  {canResend ? (
                    <TouchableOpacity
                      onPress={handleResendOtp}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Resend OTP"
                    >
                      <Text style={styles.resendActiveText}>Resend OTP</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.resendTimerText}>
                      Resend in {timer < 10 ? `0${timer}` : timer}s
                    </Text>
                  )}
                </View>

                {/* Primary Verify Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleVerifyOtp}
                  disabled={otp.length !== 6}
                  style={[
                    styles.verifyButton,
                    otp.length !== 6 && styles.verifyButtonDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Verify OTP"
                >
                  <Text
                    style={[
                      styles.verifyButtonText,
                      otp.length !== 6 && styles.verifyButtonTextDisabled,
                    ]}
                  >
                    Verify OTP →
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Bottom Trust Badge */}
            <View style={styles.trustArea}>
              <Text style={styles.trustText}>
                🔒 6-digit codes are valid for a single session.
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
    marginBottom: 10,
  },
  identifierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 8,
  },
  identifierText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  editLink: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  editLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
  otpCard: {
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
    marginBottom: 18,
    textAlign: 'center',
  },
  otpInputContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpBoxFocused: {
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
  },
  otpBoxError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '500',
  },
  resendNoticeText: {
    fontSize: 12,
    color: '#16A34A',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600',
  },
  resendSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 6,
  },
  resendPrompt: {
    fontSize: 13,
    color: '#64748B',
  },
  resendTimerText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  resendActiveText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '700',
  },
  verifyButton: {
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
  verifyButtonDisabled: {
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
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  verifyButtonTextDisabled: {
    color: '#94A3B8',
  },
  successCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    ...Platform.select({
      ios: {
        shadowColor: '#16A34A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
    borderColor: '#86EFAC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  successCheckIcon: {
    fontSize: 28,
    fontWeight: '800',
    color: '#16A34A',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#15803D',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  successMessage: {
    fontSize: 14,
    color: '#166534',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  demoNoticeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 8,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  demoNoticeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  continueRingersButton: {
    backgroundColor: '#16A34A',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#16A34A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  continueRingersText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
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
