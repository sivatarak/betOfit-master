import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/themecontext';

interface Props {
  tipId: string;
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export function ContextualTip({ tipId, message, icon }: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user?.uid) {
      setVisible(false);
      return () => {
        active = false;
      };
    }

    const loadTipStatus = async () => {
      try {
        const key = `USER_TIP_SEEN_V1:${user.uid}:${tipId}`;
        const hasSeenTip = await AsyncStorage.getItem(key);
        if (active) setVisible(hasSeenTip !== 'true');
      } catch (error) {
        console.error(`Could not load ${tipId} tip status:`, error);
        if (active) setVisible(true);
      }
    };

    loadTipStatus();
    return () => {
      active = false;
    };
  }, [tipId, user?.uid]);

  const dismissTip = async () => {
    setVisible(false);
    if (!user?.uid) return;
    try {
      await AsyncStorage.setItem(`USER_TIP_SEEN_V1:${user.uid}:${tipId}`, 'true');
    } catch (error) {
      console.error(`Could not save ${tipId} tip status:`, error);
    }
  };

  if (!visible) return null;

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginVertical: 10,
      paddingVertical: 11,
      paddingLeft: 12,
      paddingRight: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: `${colors.primary}50`,
      backgroundColor: colors.card,
    }}>
      <View style={{
        width: 30,
        height: 30,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        backgroundColor: `${colors.primary}18`,
      }}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={{
        flex: 1,
        color: colors.textSecondary,
        fontSize: 12,
        lineHeight: 17,
        fontWeight: '600',
      }}>
        {message}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Dismiss tip"
        hitSlop={10}
        onPress={dismissTip}
        style={{ padding: 6, marginLeft: 4 }}
      >
        <Ionicons name="close" size={17} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}
