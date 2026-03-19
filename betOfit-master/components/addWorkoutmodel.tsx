import React, { useState } from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet } from "react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, duration: number) => void;
}

export default function AddWorkoutModal({ visible, onClose, onAdd }: Props) {
  const [duration, setDuration] = useState(20);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Add Workout</Text>

          <Text style={styles.label}>Duration</Text>

          <View style={styles.row}>
            <TouchableOpacity onPress={() => setDuration(d => Math.max(5, d - 5))}>
              <Text style={styles.btn}>−</Text>
            </TouchableOpacity>

            <Text style={styles.value}>{duration} min</Text>

            <TouchableOpacity onPress={() => setDuration(d => d + 5)}>
              <Text style={styles.btn}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.add}
            onPress={() => {
              onAdd("Workout", duration);
              onClose();
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Add</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  title: { fontSize: 20, fontWeight: "800" },
  label: { marginTop: 20, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 20, marginVertical: 20 },
  btn: { fontSize: 28, fontWeight: "700" },
  value: { fontSize: 18, fontWeight: "700" },
  add: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancel: { marginTop: 12, color: "#888" },
});
