import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

type RoleType = 'customer' | 'vendor' | 'delivery';

interface RoleOption {
  id: RoleType;
  title: string;
  badge: string;
  subtitle: string;
  icon: string;
  benefits: string[];
  theme: {
    selectedBorder: string;
    selectedBg: string;
    badgeBg: string;
    badgeText: string;
    iconBgSelected: string;
    accentColor: string;
  };
}

const ROLES: RoleOption[] = [
  {
    id: 'customer',
    title: 'Customer',
    badge: 'SHOP & ORDER',
    subtitle: 'Discover local stores and order what you need.',
    icon: '🛒',
    benefits: [
      'Browse local products',
      'Order daily essentials',
      'Track your delivery',
      'Pay securely',
    ],
    theme: {
      selectedBorder: '#2563EB',
      selectedBg: '#F4F8FF',
      badgeBg: '#EFF6FF',
      badgeText: '#1D4ED8',
      iconBgSelected: '#DBEAFE',
      accentColor: '#2563EB',
    },
  },
  {
    id: 'vendor',
    title: 'Vendor',
    badge: 'SELL & GROW',
    subtitle: 'Bring your business online and reach local customers.',
    icon: '🏪',
    benefits: [
      'List your products',
      'Manage orders',
      'Manage inventory',
      'Track sales',
    ],
    theme: {
      selectedBorder: '#0D9488',
      selectedBg: '#F0FDFA',
      badgeBg: '#F0FDFA',
      badgeText: '#0F766E',
      iconBgSelected: '#CCFBF1',
      accentColor: '#0D9488',
    },
  },
  {
    id: 'delivery',
    title: 'Delivery Partner',
    badge: 'DELIVER & EARN',
    subtitle: 'Deliver local orders and earn on every delivery.',
    icon: '🛵',
    benefits: [
      'Accept delivery tasks',
      'Navigate to customers',
      'Track delivery status',
      'Earn on every order',
    ],
    theme: {
      selectedBorder: '#EA580C',
      selectedBg: '#FFF7ED',
      badgeBg: '#FFF7ED',
      badgeText: '#C2410C',
      iconBgSelected: '#FFEDD5',
      accentColor: '#EA580C',
    },
  },
];

export default function RoleSelectionScreen() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);

  const handleSelectRole = (roleId: RoleType) => {
    setSelectedRole(roleId);
  };

  const handleContinue = () => {
    if (!selectedRole) return;

    // Navigate to Login screen passing the selected role parameter ('customer', 'vendor', or 'delivery')
    router.push({
      pathname: '/(auth)/login',
      params: { role: selectedRole },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Decorative Background Ambient Shapes */}
      <View pointerEvents="none" style={styles.backgroundDecorations}>
        <View style={styles.decorBlobTop} />
        <View style={styles.decorBlobBottom} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          {/* Top Brand Header */}
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
            <Text style={styles.brandPill}>One platform. Everything local.</Text>
          </View>

          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Let’s Get You Started</Text>
            <Text style={styles.heroSubtitle}>
              Choose how you want to experience Ringers.
            </Text>
          </View>

          {/* Role Cards List */}
          <View style={styles.cardsContainer}>
            {ROLES.map((role) => {
              const isSelected = selectedRole === role.id;
              return (
                <TouchableOpacity
                  key={role.id}
                  activeOpacity={0.88}
                  onPress={() => handleSelectRole(role.id)}
                  style={[
                    styles.card,
                    isSelected && {
                      borderColor: role.theme.selectedBorder,
                      backgroundColor: role.theme.selectedBg,
                      ...styles.cardSelected,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${role.title} role. ${role.subtitle}`}
                >
                  {/* Card Header Row */}
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.iconContainer,
                        isSelected && {
                          backgroundColor: role.theme.iconBgSelected,
                        },
                      ]}
                    >
                      <Text style={styles.roleIcon}>{role.icon}</Text>
                    </View>

                    <View style={styles.cardTitleBlock}>
                      <View style={styles.titleBadgeRow}>
                        <Text style={styles.roleTitle}>{role.title}</Text>
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor: isSelected
                                ? role.theme.badgeBg
                                : '#F1F5F9',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              {
                                color: isSelected
                                  ? role.theme.badgeText
                                  : '#64748B',
                              },
                            ]}
                          >
                            {role.badge}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.roleSubtitle}>{role.subtitle}</Text>
                    </View>

                    {/* Radio / Check Indicator */}
                    <View
                      style={[
                        styles.radioIndicator,
                        isSelected && {
                          borderColor: role.theme.selectedBorder,
                          backgroundColor: role.theme.selectedBorder,
                        },
                      ]}
                    >
                      {isSelected ? (
                        <Text style={styles.checkMark}>✓</Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Supporting Benefit Points */}
                  <View
                    style={[
                      styles.benefitsContainer,
                      isSelected && { borderTopColor: 'rgba(0, 0, 0, 0.06)' },
                    ]}
                  >
                    {role.benefits.map((benefit, index) => (
                      <View key={index} style={styles.benefitItem}>
                        <View
                          style={[
                            styles.bulletIndicator,
                            isSelected && {
                              backgroundColor: role.theme.accentColor,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.benefitText,
                            isSelected && styles.benefitTextSelected,
                          ]}
                        >
                          {benefit}
                        </Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Primary Action Button */}
          <View style={styles.actionSection}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleContinue}
              disabled={!selectedRole}
              style={[
                styles.continueButton,
                !selectedRole && styles.continueButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Continue to login"
            >
              <Text
                style={[
                  styles.continueButtonText,
                  !selectedRole && styles.continueButtonTextDisabled,
                ]}
              >
                Continue
              </Text>
            </TouchableOpacity>
          </View>

          {/* Trust & Community Footer */}
          <View style={styles.trustFooter}>
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🛡️</Text>
              <Text style={styles.trustLabel}>Safe & Secure</Text>
            </View>
            <View style={styles.trustDot} />
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🏬</Text>
              <Text style={styles.trustLabel}>Built for Local Businesses</Text>
            </View>
            <View style={styles.trustDot} />
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🤝</Text>
              <Text style={styles.trustLabel}>Made for Communities</Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 22,
  },
  brandTextContainer: {
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#0F172A',
  },
  brandTagline: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#2563EB',
    marginTop: 1,
  },
  brandPill: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 22,
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 14.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  cardsContainer: {
    gap: 14,
    marginBottom: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardSelected: {
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleIcon: {
    fontSize: 24,
  },
  cardTitleBlock: {
    flex: 1,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  roleTitle: {
    fontSize: 17.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roleSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
    marginTop: 2,
  },
  radioIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    marginTop: 2,
  },
  checkMark: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 14,
  },
  benefitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  benefitItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3.5,
    paddingRight: 6,
  },
  bulletIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    marginRight: 7,
  },
  benefitText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  benefitTextSelected: {
    color: '#334155',
    fontWeight: '600',
  },
  actionSection: {
    marginBottom: 18,
  },
  continueButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
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
  continueButtonDisabled: {
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
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  continueButtonTextDisabled: {
    color: '#94A3B8',
  },
  trustFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 8,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustIcon: {
    fontSize: 12,
  },
  trustLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  trustDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
});
