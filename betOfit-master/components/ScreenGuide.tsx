import { useEffect, useState } from 'react';
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/themecontext';

interface Props {
  screenId: string;
  title: string;
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
  enabled?: boolean;
}

export function ScreenGuide({
  screenId,
  title,
  message,
  icon,
  enabled = true,
}: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    if (!enabled || !user?.uid) {
      setVisible(false);
      return () => {
        active = false;
      };
    }

    const loadGuideStatus = async () => {
      try {
        const key = `USER_GUIDE_SEEN_V1:${user.uid}:${screenId}`;
        const hasSeenGuide = await AsyncStorage.getItem(key);
        if (active) setVisible(hasSeenGuide !== 'true');
      } catch (error) {
        console.error(`Could not load ${screenId} guide status:`, error);
      }
    };

    loadGuideStatus();
    return () => {
      active = false;
    };
  }, [enabled, screenId, user?.uid]);

  const dismissGuide = async () => {
    setVisible(false);
    if (!user?.uid) return;
    try {
      await AsyncStorage.setItem(`USER_GUIDE_SEEN_V1:${user.uid}:${screenId}`, 'true');
    } catch (error) {
      console.error(`Could not save ${screenId} guide status:`, error);
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      statusBarTranslucent
      onRequestClose={dismissGuide}
    >
      <View style={{
        flex: 1,
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingBottom: 24,
        backgroundColor: 'rgba(0,0,0,0.56)',
      }}>
        <View style={{
          width: '100%',
          maxWidth: 520,
          alignSelf: 'center',
          padding: 22,
          borderRadius: 26,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.22,
          shadowRadius: 20,
          elevation: 18,
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${colors.primary}18`,
            }}>
              <Ionicons name={icon} size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 13 }}>
              <Text style={{
                color: colors.primary,
                fontSize: 10,
                fontWeight: '900',
                letterSpacing: 1.4,
              }}>
                QUICK GUIDE
              </Text>
              <Text style={{
                color: colors.text,
                fontSize: 19,
                fontWeight: '900',
                marginTop: 3,
              }}>
                {title}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Skip screen guide"
              onPress={dismissGuide}
              hitSlop={10}
              style={{
                minWidth: 46,
                minHeight: 42,
                alignItems: 'flex-end',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700' }}>
                Skip
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 21,
          }}>
            {message}
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={dismissGuide}
            activeOpacity={0.85}
            style={{
              minHeight: 50,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              marginTop: 22,
              borderRadius: 15,
              backgroundColor: colors.primary,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }}>
              Got it
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
