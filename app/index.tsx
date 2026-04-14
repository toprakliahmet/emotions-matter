import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { supabase } from '../lib/supabase';

const BG = '#F5F0E8';
const TEXT = '#1A1612';
const ACCENT = '#5C4A32';
const ONBOARDING_KEY = 'onboarding_completed';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id: number;
  text: string;
  hint?: string | null;
  note?: string | null;
}

interface Slide {
  id: number;
  text: string;
  isLast?: boolean;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SLIDES: Slide[] = [
  { id: 1, text: 'Bir sorunun ne kadar güçlü olabileceğini fark ettim.' },
  {
    id: 2,
    text: 'İnsanlara sorular sormayı ve onları tanımayı seviyorum. Ama istediğim soruları her zaman bulamıyorum.',
  },
  {
    id: 3,
    text: 'Buradaki sorular tek cevaplı değil. Uzun uzun düşünülmesi gerekiyor.',
  },
  {
    id: 4,
    text: "Tek başına, yakın arkadaşınla, sevgilinde veya bir date'inde oyna.",
    isLast: true,
  },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);

  function handleNext() {
    if (slideIndex + 1 >= SLIDES.length) {
      onDone();
      return;
    }
    const next = slideIndex + 1;
    setSlideIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList<Slide>
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={[styles.slidePage, { width }]}>
            <Text style={styles.slideText}>{item.text}</Text>
          </View>
        )}
      />

      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === slideIndex && styles.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={[styles.button, { marginBottom: 48 }]} onPress={handleNext}>
        <Text style={styles.buttonText}>
          {SLIDES[slideIndex].isLast ? 'Başla' : 'Devam →'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Suggest Modal ────────────────────────────────────────────────────────────

function SuggestModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    await supabase.from('suggestions').insert({ text: text.trim() });
    setSending(false);
    setDone(true);
  }

  function handleClose() {
    setText('');
    setDone(false);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalSheet}>
          {done ? (
            <>
              <Text style={styles.modalTitle}>Teşekkürler!</Text>
              <Text style={styles.modalSub}>
                Sorun alındı. İyi sorular için minnettarız.
              </Text>
              <TouchableOpacity style={styles.button} onPress={handleClose}>
                <Text style={styles.buttonText}>Kapat</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>Soru öner</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Sorunuzu buraya yazın..."
                placeholderTextColor={ACCENT + '66'}
                value={text}
                onChangeText={setText}
                multiline
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={handleClose}>
                  <Text style={styles.cancelText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, (!text.trim() || sending) && styles.buttonDisabled]}
                  onPress={handleSend}
                  disabled={!text.trim() || sending}
                >
                  <Text style={styles.buttonText}>{sending ? '...' : 'Gönder'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [suggestVisible, setSuggestVisible] = useState(false);

  useEffect(() => {
    async function checkOnboarding() {
      const val = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (val === 'true') {
        setOnboardingDone(true);
        return;
      }
      // migrate from old key
      const legacy = await AsyncStorage.getItem('onboarding_complete');
      if (legacy === 'true') {
        await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        setOnboardingDone(true);
        return;
      }
      setOnboardingDone(false);
    }
    checkOnboarding();
  }, []);

  async function completeOnboarding() {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setOnboardingDone(true);
  }

  async function fetchQuestions() {
    setLoading(true);
    setError(null);
    setFinished(false);
    setIndex(0);

    const { data, error: err } = await supabase
      .from('questions')
      .select('id, text, hint, note')
      .eq('is_active', true);

    if (err) {
      setError('Sorular yüklenemedi: ' + err.message);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setError('Henüz aktif soru yok.');
      setLoading(false);
      return;
    }

    setQuestions(shuffle(data as Question[]));
    setLoading(false);
  }

  useEffect(() => {
    if (onboardingDone) fetchQuestions();
  }, [onboardingDone]);

  function handleNext() {
    if (index + 1 >= questions.length) {
      setFinished(true);
    } else {
      setIndex(index + 1);
    }
  }

  function handlePrev() {
    if (index > 0) setIndex(index - 1);
  }

  function handleRestart() {
    setQuestions(shuffle(questions));
    setIndex(0);
    setFinished(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (onboardingDone === null) return null;

  if (!onboardingDone) {
    return <OnboardingScreen onDone={completeOnboarding} />;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={ACCENT} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={fetchQuestions}>
          <Text style={styles.buttonText}>Tekrar dene</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (finished) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.finishedTitle}>Hepsi bu kadardı</Text>
          <Text style={styles.finishedSub}>{questions.length} soruyu tamamladın.</Text>
          <TouchableOpacity style={styles.button} onPress={handleRestart}>
            <Text style={styles.buttonText}>Baştan başla</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const current = questions[index];

  return (
    <SafeAreaView style={styles.container}>
      {/* Counter */}
      <Text style={styles.counter}>
        {index + 1} / {questions.length}
      </Text>

      {/* Question */}
      <View style={styles.content}>
        <Text style={styles.questionText}>{current.text}</Text>
        {current.hint ? <Text style={styles.hintText}>{current.hint}</Text> : null}
        {current.note ? (
          <View style={styles.noteDividerRow}>
            <View style={styles.noteDivider} />
            <Text style={styles.noteText}>{current.note}</Text>
          </View>
        ) : null}
      </View>

      {/* Navigation */}
      <View style={styles.navRow}>
        {index > 0 && (
          <TouchableOpacity style={styles.buttonSecondary} onPress={handlePrev}>
            <Text style={styles.buttonSecondaryText}>← Önceki</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {index + 1 === questions.length ? 'Bitir' : 'Sıradaki →'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Suggest */}
      <TouchableOpacity style={styles.suggestButton} onPress={() => setSuggestVisible(true)}>
        <Text style={styles.suggestText}>Soru öner</Text>
      </TouchableOpacity>

      <SuggestModal visible={suggestVisible} onClose={() => setSuggestVisible(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  // Counter
  counter: {
    position: 'absolute',
    top: 60,
    fontFamily: 'Lora_400Regular',
    fontSize: 14,
    color: ACCENT,
    opacity: 0.7,
  },

  // Content area
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  questionText: {
    fontFamily: 'Lora_700Bold',
    fontSize: 22,
    color: TEXT,
    textAlign: 'center',
    lineHeight: 34,
  },
  hintText: {
    fontFamily: 'Lora_400Regular_Italic',
    fontSize: 14,
    color: ACCENT,
    textAlign: 'center',
    marginTop: 20,
    opacity: 0.85,
  },

  // Read-only note from DB
  noteDividerRow: {
    alignItems: 'center',
    marginTop: 28,
    width: '70%',
  },
  noteDivider: {
    width: 32,
    height: 1,
    backgroundColor: ACCENT,
    opacity: 0.25,
    marginBottom: 12,
  },
  noteText: {
    fontFamily: 'Lora_400Regular_Italic',
    fontSize: 13,
    color: ACCENT,
    textAlign: 'center',
    opacity: 0.55,
    lineHeight: 20,
  },

  // Navigation row
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
    gap: 16,
  },

  // Primary button
  button: {
    width: 140,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 4,
  },
  buttonText: {
    fontFamily: 'Lora_400Regular',
    fontSize: 16,
    color: ACCENT,
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.35,
  },

  // Secondary button
  buttonSecondary: {
    width: 140,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 4,
    opacity: 0.6,
  },
  buttonSecondaryText: {
    fontFamily: 'Lora_400Regular',
    fontSize: 15,
    color: ACCENT,
  },

  // Suggest button
  suggestButton: {
    marginBottom: 32,
    paddingVertical: 6,
  },
  suggestText: {
    fontFamily: 'Lora_400Regular_Italic',
    fontSize: 13,
    color: ACCENT,
    opacity: 0.5,
    textDecorationLine: 'underline',
  },

  // Error / finished
  errorText: {
    fontFamily: 'Lora_400Regular',
    fontSize: 16,
    color: TEXT,
    textAlign: 'center',
    marginBottom: 24,
  },
  finishedTitle: {
    fontFamily: 'Lora_700Bold',
    fontSize: 26,
    color: TEXT,
    textAlign: 'center',
    marginBottom: 12,
  },
  finishedSub: {
    fontFamily: 'Lora_400Regular_Italic',
    fontSize: 15,
    color: ACCENT,
    textAlign: 'center',
    marginBottom: 40,
    opacity: 0.8,
  },

  // Onboarding
  slidePage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  slideText: {
    fontFamily: 'Lora_400Regular_Italic',
    fontSize: 20,
    color: TEXT,
    textAlign: 'center',
    lineHeight: 34,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: ACCENT,
    opacity: 0.25,
  },
  dotActive: {
    opacity: 1,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(26,22,18,0.45)',
  },
  modalSheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 28,
    paddingBottom: 40,
  },
  modalTitle: {
    fontFamily: 'Lora_700Bold',
    fontSize: 20,
    color: TEXT,
    marginBottom: 16,
  },
  modalSub: {
    fontFamily: 'Lora_400Regular',
    fontSize: 15,
    color: ACCENT,
    marginBottom: 24,
    lineHeight: 24,
  },
  textInput: {
    fontFamily: 'Lora_400Regular',
    fontSize: 15,
    color: TEXT,
    borderWidth: 1,
    borderColor: ACCENT + '55',
    borderRadius: 6,
    padding: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelText: {
    fontFamily: 'Lora_400Regular',
    fontSize: 15,
    color: ACCENT,
    opacity: 0.6,
  },
});
