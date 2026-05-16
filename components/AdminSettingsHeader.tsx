import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import iconPng from "../assets/images/icon.png";
import apiClient from "../lib/apiClient";
import { getStoredLogoVersion, withLogoVersion } from "../lib/logoVersion";
import AdminWavyHeader from "./AdminWavyHeader";

/* ── Props ────────────────────────────────────────────────── */
type Props = {
  /** Main heading text */
  title: string;
  /** Smaller text below the title */
  subtitle?: string;
  /** Optional ReactNode rendered to the right of the title (e.g. action button) */
  actionButton?: React.ReactNode;
  /** Show the "Back" link below the wave. Default true. */
  showBack?: boolean;
  /** Height of the wave header */
  height?: number;
};

/* ── Component ────────────────────────────────────────────── */
export default function AdminSettingsHeader({
  title,
  subtitle,
  actionButton,
  showBack = true,
  height = 140,
}: Props) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await apiClient.get("/api/admin/me");
        const rId = me?.restaurant_id || me?.id;
        if (rId) {
          const version = await getStoredLogoVersion();
          const res = await fetch(
            `https://qrave-backend.onrender.com/public/restaurants/${rId}/logo`,
          );
          const data = await res.json();
          setLogoUrl(withLogoVersion(data?.logo_url, version));
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return (
    <>
      <AdminWavyHeader height={height}>
        <View style={s.row}>
          <Pressable
            style={s.avatarBtn}
            onPress={() => router.replace("/admin/profile")}
          >
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={s.avatarImg} />
            ) : (
              <Image source={iconPng} style={s.avatarImg} />
            )}
          </Pressable>

          <View style={s.flex1}>
            <Text style={s.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={s.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {actionButton}
        </View>
      </AdminWavyHeader>

      {showBack && (
        <Pressable
          style={s.backRow}
          onPress={() => router.replace("/admin/profile")}
        >
          <MaterialIcons name="arrow-back" size={16} color="#64748B" />
          <Text style={s.backText}>Back to Settings</Text>
        </Pressable>
      )}
    </>
  );
}

/* ── Styles ────────────────────────────────────────────────── */
const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
  },
  avatarImg: { width: "100%", height: "100%", borderRadius: 20 },
  flex1: { flex: 1 },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#000",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: "#1a1a1a",
    fontWeight: "600",
    marginTop: 2,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backText: { color: "#64748B", fontSize: 13, fontWeight: "700" },
});
