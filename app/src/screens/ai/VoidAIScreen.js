import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform,
  Pressable, StyleSheet, Text, TextInput, View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useTheme } from "../../context/ThemeContext";
import Icon from "../../components/ui/Icon";
import { generateVoidAIReply, getOnDeviceRuntime } from "./aiService";

const HISTORY_KEY = "voidation:void-ai:history:v1";
const MODEL_KEY = "voidation:void-ai:model-path:v1";
const NativeVoidAI = getOnDeviceRuntime();
const STARTER_PROMPTS = [
  "What can you help me with?",
  "Summarize my library",
  "What have I dropped?",
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function VoidAIScreen({ navigation }) {
  const { C, dark } = useTheme();
  const styles = makeStyles(C, dark);
  const listRef = useRef(null);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text: "Hey, I'm Void AI. I can help you explore your Voidation library. Load a compatible on-device model for generative chat, or try Local Quick Mode for basic library questions.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [modelPath, setModelPath] = useState(null);
  const [modelName, setModelName] = useState("");
  const [modelError, setModelError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(HISTORY_KEY), AsyncStorage.getItem(MODEL_KEY)])
      .then(([history, savedPath]) => {
        if (!active) return;
        if (history) {
          try {
            const parsed = JSON.parse(history);
            if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
          } catch {}
        }
        if (savedPath) {
          FileSystem.getInfoAsync(savedPath).then((info) => {
            if (active && info.exists) {
              setModelPath(savedPath);
              setModelName(savedPath.split("/").pop() || "On-device model");
            } else if (active) {
              AsyncStorage.removeItem(MODEL_KEY).catch(() => {});
            }
          }).catch(() => {});
        }
      }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (messages.length > 1) AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-80))).catch(() => {});
  }, [messages]);

  const loadModel = useCallback(async () => {
    if (!NativeVoidAI) {
      Alert.alert(
        "Native runtime not available",
        "Void AI's on-device runtime is available only in a custom Android development build or APK that includes the native module. It will not run in Expo Go. Build the app after installing the Void AI native module."
      );
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!String(asset.name || "").toLowerCase().endsWith(".litertlm")) {
        Alert.alert("Unsupported model file", "Choose a LiteRT-LM model file ending in .litertlm.");
        return;
      }
      const destination = `${FileSystem.documentDirectory}void-ai-model.litertlm`;
      setModelError("");
      await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => {});
      await FileSystem.copyAsync({ from: asset.uri, to: destination });
      // Verify the native runtime can open the model before saving it as active.
      setBusy(true);
      await NativeVoidAI.checkModel(destination);
      setModelPath(destination);
      setModelName(asset.name || "On-device model");
      await AsyncStorage.setItem(MODEL_KEY, destination);
      Alert.alert("Model ready", `${asset.name || "Your model"} is stored on this device.`);
    } catch (error) {
      const message = error?.message || "The model could not be loaded.";
      setModelError(message);
      Alert.alert("Couldn't load model", message);
    } finally {
      setBusy(false);
    }
  }, []);

  const clearChat = useCallback(() => {
    Alert.alert("Clear conversation?", "This deletes the saved Void AI chat history on this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => {
        const fresh = [{
          id: makeId(), role: "assistant",
          text: "Conversation cleared. I'm ready when you are."
        }];
        setMessages(fresh);
        AsyncStorage.removeItem(HISTORY_KEY).catch(() => {});
      }},
    ]);
  }, []);

  const sendMessage = useCallback(async (raw) => {
    const question = String(raw || "").trim();
    if (!question || busy) return;
    const userMessage = { id: makeId(), role: "user", text: question };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setModelError("");
    try {
      const reply = await generateVoidAIReply({ question, modelPath });
      setMessages((current) => [...current, { id: makeId(), role: "assistant", text: String(reply).trim() }]);
    } catch (error) {
      const message = error?.message || "Something went wrong.";
      setModelError(message);
      setMessages((current) => [...current, {
        id: makeId(), role: "assistant",
        text: `I couldn't get a response from the on-device model. Your conversation is still here. Check that the selected model is compatible and that your phone has enough memory.\n\nDetails: ${message}`,
      }]);
    } finally {
      setBusy(false);
    }
  }, [busy, messages, modelPath]);

  const renderMessage = ({ item }) => {
    const user = item.role === "user";
    return (
      <View style={[styles.messageRow, user && styles.userRow]}>
        {!user && <View style={styles.avatar}><Icon name="ai" size={17} color={C.purple} /></View>}
        <View style={[styles.bubble, user ? styles.userBubble : styles.assistantBubble]}>
          <Text selectable style={[styles.messageText, user && styles.userText]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="back" size={22} color={C.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title}>Void AI</Text>
          <Text style={styles.subtitle}>{modelPath ? "On-device model" : "Local Quick Mode"}</Text>
        </View>
        <Pressable onPress={loadModel} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Load on-device model">
          <Icon name="cpu" size={21} color={C.purple} />
        </Pressable>
        <Pressable onPress={clearChat} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Clear chat">
          <Icon name="storage" size={20} color={C.sub} />
        </Pressable>
      </View>

      <View style={styles.modelCard}>
        <View style={[styles.statusDot, modelPath && styles.statusDotReady]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.modelTitle}>{modelPath ? modelName : "No language model loaded"}</Text>
          <Text style={styles.modelSub}>
            {modelPath ? "Messages are processed on this device." : "Basic library answers work offline. Load a .litertlm model for generative chat."}
          </Text>
        </View>
        <Pressable onPress={loadModel} disabled={busy} style={styles.loadButton}>
          <Text style={styles.loadButtonText}>{modelPath ? "Change" : "Load model"}</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={messages.length <= 1 ? (
          <View style={styles.promptWrap}>
            <Text style={styles.promptHeading}>Try asking</Text>
            {STARTER_PROMPTS.map((prompt) => (
              <Pressable key={prompt} onPress={() => sendMessage(prompt)} disabled={busy} style={styles.prompt}>
                <Text style={styles.promptText}>{prompt}</Text>
                <Icon name="send" size={14} color={C.purple} />
              </Pressable>
            ))}
          </View>
        ) : null}
        ListFooterComponent={busy ? (
          <View style={styles.thinking}><ActivityIndicator size="small" color={C.purple} /><Text style={styles.thinkingText}>Thinking on this device…</Text></View>
        ) : null}
      />

      {!!modelError && <Text style={styles.error} numberOfLines={2}>{modelError}</Text>}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask Void AI…"
            placeholderTextColor={C.faint}
            multiline
            maxLength={2000}
            editable={!busy}
            style={styles.input}
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
            accessibilityLabel="Message Void AI"
          />
          <Pressable
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || busy}
            style={[styles.sendButton, (!input.trim() || busy) && { opacity: 0.45 }]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="send" size={18} color="#fff" />}
          </Pressable>
        </View>
        <Text style={styles.disclaimer}>On-device first · Your library stays on your phone</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (C, dark) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 },
  headerButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headerTitleWrap: { flex: 1 },
  title: { color: C.text, fontSize: 20, fontWeight: "800" },
  subtitle: { color: C.sub, fontSize: 11, marginTop: 1 },
  modelCard: { margin: 12, marginBottom: 4, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.faint },
  statusDotReady: { backgroundColor: "#36b37e" },
  modelTitle: { color: C.text, fontWeight: "700", fontSize: 12 },
  modelSub: { color: C.sub, fontSize: 11, marginTop: 3, lineHeight: 15 },
  loadButton: { backgroundColor: C.purple, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9 },
  loadButtonText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  messages: { padding: 14, paddingBottom: 20, flexGrow: 1 },
  messageRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14, gap: 8 },
  userRow: { justifyContent: "flex-end" },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", marginTop: 2 },
  bubble: { maxWidth: "84%", borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10 },
  userBubble: { backgroundColor: C.orange, borderBottomRightRadius: 5 },
  assistantBubble: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 5 },
  messageText: { color: C.text, fontSize: 14, lineHeight: 20 },
  userText: { color: "#fff" },
  promptWrap: { paddingLeft: 36, paddingTop: 8, paddingBottom: 12 },
  promptHeading: { color: C.sub, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  prompt: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 7, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  promptText: { color: C.text, fontSize: 13, flex: 1 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 36, paddingVertical: 10 },
  thinkingText: { color: C.sub, fontSize: 12 },
  error: { color: C.rose, fontSize: 11, paddingHorizontal: 14, paddingBottom: 4 },
  composer: { marginHorizontal: 12, marginTop: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 18, paddingLeft: 14, paddingRight: 6, paddingVertical: 6, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, minHeight: 40, maxHeight: 120, color: C.text, fontSize: 14, paddingTop: 10, paddingBottom: 8 },
  sendButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.purple, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  disclaimer: { textAlign: "center", color: C.faint, fontSize: 10, paddingTop: 7, paddingBottom: 4 },
});
