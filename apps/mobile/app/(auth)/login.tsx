import React, { useState, useEffect } from 'react';
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
  title: string;
  badge: string;
  subtitle: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
  iconBg: string;
  accentColor: string;
  placeholder: string;
}

const ROLE_DETAILS: Record<RoleType, RoleConfig> = {
  customer: {
    title: 'Welcome back, Customer',
    badge: 'CUSTOMER LOGIN',
    subtitle: 'Your local essentials are just a few taps away.',
    icon: '🛒',
    badgeBg: '#EFF6FF',
    badgeText: '#1D4ED8',
    iconBg: '#DBEAFE',
    accentColor: '#2563EB',
    placeholder: 'Enter mobile number or username',
  },
  vendor: {
    title: 'Welcome back, Vendor',
    badge: 'MERCHANT LOGIN',
    subtitle: 'Manage your business and serve your customers.',
    icon: '🏪',
    badgeBg: '#FFF7ED',
    badgeText: '#C2410C',
    iconBg: '#FFEDD5',
    accentColor: '#EA580C',
    placeholder: 'Enter phone or vendor ID',
  },
  delivery: {
    title: 'Welcome back, Delivery Partner',
    badge: 'FLEET LOGIN',
    subtitle: 'Your next delivery is waiting for you.',
    icon: '🛵',
    badgeBg: '#F0FDF4',
    badgeText: '#15803D',
    iconBg: '#DCFCE7',
    accentColor: '#16A34A',
    placeholder: 'Enter phone or rider ID',
  },
};

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string; identifier?: string }>();

  const role: RoleType =
    params.role === 'vendor' || params.role === 'delivery'
      ? params.role
      : 'customer';

  const roleConfig = ROLE_DETAILS[role];

  const [identifier, setIdentifier] = useState(params.identifier || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [isIdentifierFocused, setIsIdentifierFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  useEffect(() => {
    if (params.identifier) {
      setIdentifier(params.identifier);
    }
  }, [params.identifier]);

  const handleBackToRoleSelection = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/role-selection');
    }
  };

  const handleForgotPassword = () => {
    router.push({
      pathname: '/(auth)/forgot-password',
      params: {
        role,
        ...(identifier.trim() ? { identifier: identifier.trim() } : {}),
      },
    });
  };

  const handleLogin = () => {
    const newErrors: { identifier?: string; password?: string } = {};

    if (!identifier.trim()) {
      newErrors.identifier = 'Please enter your mobile number or user ID.';
    }

    if (!password) {
      newErrors.password = 'Please enter your password.';
    } else if (password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    // Frontend validation successful -> Navigate to OTP screen with route parameters (No backend/API request)
    router.push({
      pathname: '/(auth)/otp',
      params: {
        role,
        identifier: identifier.trim(),
      },
    });
  };

  const isFormFilled = Boolean(identifier.trim() && password);

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
                onPress={handleBackToRoleSelection}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Back to role selection"
              >
                <Text style={styles.backButtonIcon}>←</Text>
                <Text style={styles.backButtonText}>Change Role</Text>
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
              <View
                style={[
                  styles.roleIconCircle,
                  { backgroundColor: roleConfig.iconBg },
                ]}
              >
                <Text style={styles.roleIconText}>{roleConfig.icon}</Text>
              </View>
              <Text style={styles.heroTitle}>{roleConfig.title}</Text>
              <Text style={styles.heroSubtitle}>{roleConfig.subtitle}</Text>
            </View>

            {/* Centered Compact Form Card */}
            <View style={styles.formCard}>
              {/* Identifier Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mobile Number or User ID</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    isIdentifierFocused && styles.inputWrapperFocused,
                    Boolean(errors.identifier) && styles.inputWrapperError,
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
                      if (errors.identifier) {
                        setErrors((prev) => ({ ...prev, identifier: undefined }));
                      }
                    }}
                    onFocus={() => setIsIdentifierFocused(true)}
                    onBlur={() => setIsIdentifierFocused(false)}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {errors.identifier ? (
                  <Text style={styles.errorText}>{errors.identifier}</Text>
                ) : null}
              </View>

              {/* Password Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    isPasswordFocused && styles.inputWrapperFocused,
                    Boolean(errors.password) && styles.inputWrapperError,
                  ]}
                >
                  <Text style={styles.leadingIcon}>🔑</Text>
                  <TextInput
                    style={[styles.textInput, styles.passwordInput]}
                    placeholder="Enter your account password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(val) => {
                      setPassword(val);
                      if (errors.password) {
                        setErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={styles.showHideButton}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Text style={styles.showHideText}>
                      {showPassword ? 'Hide' : 'Show'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {errors.password ? (
                  <Text style={styles.errorText}>{errors.password}</Text>
                ) : null}
              </View>

              {/* Forgot Password Link */}
              <View style={styles.forgotContainer}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleForgotPassword}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot Password"
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {/* Primary Login Action Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleLogin}
                disabled={!isFormFilled}
                style={[
                  styles.loginButton,
                  !isFormFilled && styles.loginButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Login"
              >
                <Text
                  style={[
                    styles.loginButtonText,
                    !isFormFilled && styles.loginButtonTextDisabled,
                  ]}
                >
                  Login →
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Trust Badge */}
            <View style={styles.trustArea}>
              <Text style={styles.trustText}>
                🔒 Your account information stays secure.
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
  roleIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  roleIconText: {
    fontSize: 24,
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
    paddingHorizontal: 12,
  },
  formCard: {
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
  inputGroup: {
    marginBottom: 16,
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
  passwordInput: {
    paddingRight: 6,
  },
  showHideButton: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  showHideText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
    marginLeft: 2,
    fontWeight: '500',
  },
  forgotContainer: {
    alignItems: 'flex-end',
    marginBottom: 20,
    marginTop: 2,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  loginButton: {
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
  loginButtonDisabled: {
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
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  loginButtonTextDisabled: {
    color: '#94A3B8',
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
