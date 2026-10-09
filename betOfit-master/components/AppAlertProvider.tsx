import { ReactNode, useEffect, useState } from 'react';
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/themecontext';
import { AppAlertConfig, registerAppAlertHandler } from '../app/utils/appAlert';

interface Props {
  children: ReactNode;
}

export function AppAlertProvider({ children }: Props) {
  const { colors } = useTheme();
  const [alert, setAlert] = useState<AppAlertConfig | null>(null);
  const buttons = alert?.buttons?.length ? alert.buttons : [{ text: 'OK' }];
  const primaryIndex = buttons.reduce(
    (primary, button, index) =>
      button.style === 'cancel' || button.style === 'destructive' ? primary : index,
    -1
  );

  useEffect(() => {
    registerAppAlertHandler(config => setAlert(config));
    return () => registerAppAlertHandler(null);
  }, []);

  const dismiss = () => {
    if (alert?.options?.cancelable === false) return;
    setAlert(null);
  };

  return (
    <>
      {children}
      <Modal
        animationType="fade"
        transparent
        visible={alert !== null}
        statusBarTranslucent
        onRequestClose={dismiss}
      >
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 28,
          backgroundColor: 'rgba(0,0,0,0.62)',
        }}>
          <View style={{
            width: '100%',
            maxWidth: 380,
            alignItems: 'center',
            padding: 24,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.28,
            shadowRadius: 22,
            elevation: 18,
          }}>
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
              backgroundColor: `${colors.primary}18`,
            }}>
              <Ionicons name="sparkles" size={25} color={colors.primary} />
            </View>
            <Text style={{
              color: colors.text,
              fontSize: 19,
              fontWeight: '900',
              textAlign: 'center',
            }}>
              {alert?.title}
            </Text>
            {!!alert?.message && (
              <Text style={{
                color: colors.textSecondary,
                fontSize: 14,
                lineHeight: 21,
                textAlign: 'center',
                marginTop: 8,
              }}>
                {alert.message}
              </Text>
            )}
            <View style={{ width: '100%', gap: 9, marginTop: 22 }}>
              {buttons.map((button, index) => {
                const destructive = button.style === 'destructive';
                const primary = index === primaryIndex;
                const labelColor = destructive
                  ? colors.error
                  : primary
                    ? '#FFFFFF'
                    : colors.text;

                return (
                  <TouchableOpacity
                    key={`${button.text}-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={button.text}
                    activeOpacity={0.82}
                    onPress={() => {
                      setAlert(null);
                      button.onPress?.();
                    }}
                    style={{
                      minHeight: 48,
                      borderRadius: 15,
                      borderWidth: 1,
                      borderColor: primary
                        ? colors.primary
                        : destructive
                          ? `${colors.error}55`
                          : colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 16,
                      backgroundColor: primary
                        ? colors.primary
                        : destructive
                          ? `${colors.error}14`
                          : colors.background,
                    }}
                  >
                    <Text style={{ color: labelColor, fontSize: 14, fontWeight: '800' }}>
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
