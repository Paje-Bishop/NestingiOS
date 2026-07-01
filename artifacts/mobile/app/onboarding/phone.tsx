import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  OnboardingLayout,
  PrimaryButton,
} from "@/components/ui/OnboardingLayout";
import { fonts } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function PhoneScreen() {
  const colors = useColors();
  const { setOnboardingField } = useApp();
  const [phone, setPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<TextInput>(null);

  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  async function handleSendCode() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    setError(null);
    setSending(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSending(false);
    setCodeSent(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => codeRef.current?.focus(), 300);
  }

  function handleVerify() {
    if (code.length < 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setError(null);
    setOnboardingField("phone", phone.replace(/\D/g, ""));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push("/onboarding/name");
  }

  return (
    <OnboardingLayout
      step={2}
      title={codeSent ? "Enter your code" : "What's your phone number?"}
      subtitle={
        codeSent
          ? `We sent a code to ${phone}. Enter it below to continue.`
          : "We'll send you a verification code to keep your account secure."
      }
      bottomContent={
        codeSent ? (
          <PrimaryButton
            label="Verify"
            onPress={handleVerify}
            disabled={code.length < 6}
          />
        ) : (
          <TouchableOpacity
            onPress={handleSendCode}
            disabled={sending || phone.replace(/\D/g, "").length < 10}
            activeOpacity={0.8}
            style={[
              styles.btn,
              {
                backgroundColor:
                  phone.replace(/\D/g, "").length < 10 || sending
                    ? colors.muted
                    : colors.primary,
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Text
                style={[
                  styles.btnText,
                  {
                    color:
                      phone.replace(/\D/g, "").length < 10
                        ? colors.mutedForeground
                        : colors.primaryForeground,
                    fontFamily: fonts.sansSemiBold,
                  },
                ]}
              >
                Send code
              </Text>
            )}
          </TouchableOpacity>
        )
      }
    >
      <View>
        {!codeSent ? (
          <TextInput
            value={phone}
            onChangeText={(t) => {
              setPhone(formatPhone(t));
              setError(null);
            }}
            placeholder="(555) 000-0000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            autoFocus
            style={[
              styles.input,
              {
                backgroundColor: colors.secondary,
                color: colors.foreground,
                fontFamily: fonts.sansMedium,
                borderColor: error ? colors.destructive : colors.border,
              },
            ]}
          />
        ) : (
          <View>
            <TextInput
              ref={codeRef}
              value={code}
              onChangeText={(t) => {
                setCode(t.replace(/\D/g, "").slice(0, 6));
                setError(null);
              }}
              placeholder="000000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={6}
              style={[
                styles.codeInput,
                {
                  backgroundColor: colors.secondary,
                  color: colors.foreground,
                  fontFamily: fonts.sansSemiBold,
                  borderColor: error ? colors.destructive : colors.border,
                },
              ]}
            />
            <TouchableOpacity
              onPress={() => {
                setCodeSent(false);
                setCode("");
                setError(null);
              }}
              style={{ marginTop: 16, alignSelf: "center" }}
            >
              <Text
                style={[
                  styles.link,
                  {
                    color: colors.primary,
                    fontFamily: fonts.sansMedium,
                  },
                ]}
              >
                Change number
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {error && (
          <Text
            style={[
              styles.error,
              {
                color: colors.destructive,
                fontFamily: fonts.sansRegular,
              },
            ]}
          >
            {error}
          </Text>
        )}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 56,
    borderRadius: 14,
    paddingHorizontal: 18,
    fontSize: 18,
    borderWidth: 1.5,
    letterSpacing: 0.5,
  },
  codeInput: {
    height: 64,
    borderRadius: 14,
    paddingHorizontal: 18,
    fontSize: 28,
    borderWidth: 1.5,
    letterSpacing: 8,
    textAlign: "center",
  },
  btn: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: 16,
  },
  error: {
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
  },
  link: {
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
