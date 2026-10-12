import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useThemedColors } from '../theme/useTheme';

interface Step {
  title: string;
  text: string;
}

interface FirstTimeTooltipProps {
  steps: Step[];
  onFinish: () => void;
}

const { width } = Dimensions.get('window');

export default function FirstTimeTooltip({ steps, onFinish }: FirstTimeTooltipProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const colors = useThemedColors();

  if (!steps || steps.length === 0) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onFinish();
    }
  };

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Modal transparent animationType="fade" visible={true}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.text }]}>{step.title}</Text>
            <Text style={[styles.text, { color: colors.textSecondary || colors.text }]}>
              {step.text}
            </Text>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={onFinish} style={styles.skipButton}>
              <Text style={[styles.skipText, { color: colors.textMuted }]}>
                {isLastStep ? "" : "Skip"}
              </Text>
            </TouchableOpacity>

            <View style={styles.rightButtons}>
              <View style={styles.dots}>
                {steps.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      { backgroundColor: i === currentStep ? colors.primary : colors.border }
                    ]}
                  />
                ))}
              </View>

              <TouchableOpacity
                onPress={handleNext}
                style={[styles.nextButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.nextButtonText}>
                  {isLastStep ? "Done" : "Next"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: width * 0.85,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  content: {
    marginBottom: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    marginRight: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  nextButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
