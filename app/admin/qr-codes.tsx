import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ImageBackground,
  Share,
  Platform,
  RefreshControl,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import QRCode from "react-native-qrcode-svg";
import { AdminColors, Fonts } from "../../constants/theme";
import api from "../../lib/apiClient";

type Table = {
  id?: string;
  table_number?: number;
  number?: number;
  zone?: string;
  is_enabled?: boolean;
};

const templates = [
  { id: "modern", name: "Clean Minimal" },
  { id: "dark", name: "Midnight Luxury" },
  { id: "framed", name: "Bold Frame" },
];

const fonts = [
  { id: "sans", name: "Modern Sans", family: Fonts?.sans },
  { id: "serif", name: "Elegant Serif", family: Fonts?.serif },
  { id: "mono", name: "Industrial Mono", family: Fonts?.mono },
];

const brandColors = ["#000000", "#10B981", "#6366F1", "#F43F5E", "#F59E0B"];

const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_URL || "https://qrave-website.vercel.app";

const getTableNumber = (t: Table) => {
  const raw =
    t.table_number ??
    t.number ??
    (t as any)?.tableNumber ??
    (t as any)?.name ??
    t.id;
  const num = Number(raw);
  if (!Number.isNaN(num) && num > 0) return num;
  const fromId = String(raw || "").replace(/\D/g, "");
  return fromId ? Number(fromId) : 0;
};

const getTableLabel = (t: Table | null) =>
  t ? String(getTableNumber(t)).padStart(2, "0") : "";

const getTableUrl = (t: Table | null, restaurantId?: string) => {
  if (!t) return "";
  const base = `${WEB_BASE_URL}/menu/t/${getTableNumber(t)}`;
  return restaurantId ? `${base}?restaurant=${restaurantId}` : base;
};

export default function QrCodes() {
  const qrRef = useRef<any>(null);
  const printQrRef = useRef<any>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [restaurantId, setRestaurantId] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  const [template, setTemplate] = useState("modern");
  const [activeFont, setActiveFont] = useState("sans");
  const [brandColor, setBrandColor] = useState("#000000");
  const [bgImage, setBgImage] = useState<{
    uri: string;
    dataUrl?: string;
  } | null>(null);
  const [logoImage, setLogoImage] = useState<{
    uri: string;
    dataUrl?: string;
  } | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(50);

  const [headline, setHeadline] = useState("Scan to Order");
  const [subheadline, setSubheadline] = useState(
    "View menu, order & pay from your phone.",
  );
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPass, setWifiPass] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [tablesRes, me] = await Promise.all([
        api.get("/api/admin/tables"),
        api.get("/api/admin/me"),
      ]);
      const list = Array.isArray(tablesRes) ? tablesRes : [];
      setTables(list);
      if (list.length > 0) setSelectedTable(list[0]);
      const rid = me?.restaurant_id || me?.restaurantId || me?.id || "";
      setRestaurantId(rid);
    } catch (e) {
      // ignore for now
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    (async () => {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const styleId = "qr-print-style";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      @media print {
        @page { size: A5 portrait; margin: 0; }
        body { background: white !important; }
        body * { visibility: hidden !important; }
        #printable-area, #printable-area * { visibility: visible !important; }
        #printable-area {
          position: fixed;
          inset: 0;
          width: 148mm;
          height: 210mm;
          margin: 0 auto;
          background: white !important;
        }
      }
    `;
    document.head.appendChild(style);
  }, []);

  const pickImage = async (
    setter: (val: { uri: string; dataUrl?: string } | null) => void,
  ) => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      const asset = res.assets[0];
      const mime = asset.mimeType || "image/png";
      const dataUrl = asset.base64
        ? `data:${mime};base64,${asset.base64}`
        : undefined;
      setter({ uri: asset.uri, dataUrl });
    }
  };

  const fontFamily = useMemo(() => {
    const found = fonts.find((f) => f.id === activeFont);
    return found?.family;
  }, [activeFont]);

  const qrValue = getTableUrl(selectedTable, restaurantId);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!qrValue) return;
    if (!qrRef.current?.toDataURL) return;
    qrRef.current.toDataURL((data: string) => {
      if (data) {
        setQrDataUrl(`data:image/png;base64,${data}`);
      }
    });
  }, [qrValue, template, brandColor]);

  const buildPrintHtml = (qrImgOverride?: string | null) => {
    const qrImgData = qrImgOverride || qrDataUrl;
    const qrImg = qrImgData
      ? `<img src="${qrImgData}" style="width:220px;height:220px;" />`
      : "";
    const logoHtml = logoImage?.dataUrl
      ? `<img src="${logoImage.dataUrl}" style="height:48px;object-fit:contain;" />`
      : `<div style="font-size:28px;font-weight:900;letter-spacing:4px;">NOIR.</div>`;
    const bgStyle = bgImage?.dataUrl
      ? `background-image:url('${bgImage.dataUrl}');background-size:cover;background-position:center;`
      : "";
    const overlay =
      bgImage?.dataUrl
        ? `<div style="position:absolute;inset:0;background:${
            template === "dark" ? "#000" : "#fff"
          };opacity:${overlayOpacity / 100};"></div>`
        : "";
    const frame =
      template === "framed"
        ? `<div style="position:absolute;inset:16px;border:3px solid ${brandColor};border-radius:12px;"></div>`
        : "";

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4 portrait; margin: 0; }
            html, body { margin:0; padding:0; }
            body { font-family: ${
              fontFamily || "system-ui, -apple-system, Segoe UI"
            }; }
            .page {
              width: 210mm;
              height: 297mm;
              display:flex;
              align-items:center;
              justify-content:center;
              background: #fff;
            }
            .card {
              width: 148mm;
              height: 210mm;
              position: relative;
              overflow: hidden;
              border-radius: 16px;
              background: ${template === "dark" ? "#111827" : "#ffffff"};
              color: ${template === "dark" ? "#ffffff" : "#111827"};
              ${bgStyle}
            }
            .content {
              position: relative;
              z-index: 2;
              height: 100%;
              display:flex;
              flex-direction:column;
              align-items:center;
              text-align:center;
              padding: 48px 36px;
              box-sizing: border-box;
            }
            .qrbox {
              background: ${
                template === "dark" ? "rgba(255,255,255,0.1)" : "#fff"
              };
              border-radius: 20px;
              padding: 16px;
              margin: 18px 0;
              ${
                template === "dark"
                  ? "border:1px solid rgba(255,255,255,0.2);"
                  : ""
              }
            }
            .scan {
              margin-top: 10px;
              display:inline-block;
              padding: 6px 14px;
              border-radius: 20px;
              background: ${brandColor};
              color: #fff;
              font-weight: 700;
              font-size: 10px;
              letter-spacing: 1px;
            }
            .headline {
              font-size: 28px;
              font-weight: 800;
              color: ${template === "modern" ? brandColor : "inherit"};
            }
            .sub {
              font-size: 12px;
              color: ${template === "dark" ? "#d1d5db" : "#6b7280"};
              margin-top: 6px;
            }
            .footer {
              margin-top:auto;
              width:100%;
              display:flex;
              justify-content:space-between;
              border-top:1px solid rgba(0,0,0,0.1);
              padding-top: 16px;
              font-size: 10px;
              color: ${
                template === "dark" ? "rgba(255,255,255,0.7)" : "#6b7280"
              };
            }
            .value {
              font-size: 22px;
              font-weight: 900;
              color: ${template === "dark" ? "#fff" : "#111827"};
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="card">
              ${overlay}
              ${frame}
              <div class="content">
                <div style="height:48px;display:flex;align-items:center;justify-content:center;">${logoHtml}</div>
                <div class="qrbox">
                  ${qrImg}
                  <div class="scan">SCAN ME</div>
                </div>
                <div class="headline">${headline}</div>
                <div class="sub">${subheadline}</div>
                ${
                  wifiSsid
                    ? `<div style="margin-top:16px;font-size:11px;font-weight:700;">Free Wi‑Fi: ${wifiSsid}${
                        wifiPass ? ` | ${wifiPass}` : ""
                      }</div>`
                    : ""
                }
                <div class="footer">
                  <div>
                    <div>TABLE NUMBER</div>
                    <div class="value">${getTableLabel(
                      selectedTable,
                    )}</div>
                  </div>
                  <div style="text-align:right;">
                    <div>ZONE</div>
                    <div style="font-weight:700;">${
                      selectedTable?.zone || "-"
                    }</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const getQrDataUrl = () =>
    new Promise<string | null>((resolve) => {
      if (!printQrRef.current?.toDataURL) return resolve(null);
      printQrRef.current.toDataURL((data: string) => {
        resolve(data ? `data:image/png;base64,${data}` : null);
      });
    });

  const handlePrint = async () => {
    const url = getTableUrl(selectedTable, restaurantId);
    if (!url) return;
    const qrForPrint = await getQrDataUrl();
    const html = buildPrintHtml(qrForPrint);
    const file = await Print.printToFileAsync({ html, base64: true });

    if (Platform.OS === "web") {
      if (file?.base64) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${file.base64}`;
        link.download = `qr-flyer-${getTableLabel(selectedTable)}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      return;
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri);
    } else {
      await Share.share({ message: file.uri });
    }
  };

  const cardBg =
    template === "dark" ? "#111827" : template === "framed" ? "#ffffff" : "#fff";
  const cardText = template === "dark" ? "#ffffff" : "#111827";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={AdminColors.primary}
        />
      }
    >
      <Text style={styles.title}>QR Flyer Builder</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Target Table</Text>
        <Text style={styles.sectionHint}>
          Select which table this QR code is for.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tables.map((t) => {
            const selected = selectedTable?.id === t.id;
            return (
              <TouchableOpacity
                key={t.id || String(getTableNumber(t))}
                style={[
                  styles.tableChip,
                  selected && styles.tableChipActive,
                ]}
                onPress={() => setSelectedTable(t)}
              >
                <Text
                  style={[
                    styles.tableChipText,
                    selected && styles.tableChipTextActive,
                  ]}
                >
                  {getTableLabel(t)}
                </Text>
                <Text
                  style={[
                    styles.tableChipSub,
                    selected && styles.tableChipTextActive,
                  ]}
                >
                  {t.zone || "Zone"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Visual Design</Text>

        <Text style={styles.subTitle}>Layout Style</Text>
        <View style={styles.rowWrap}>
          {templates.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.choicePill,
                template === t.id && styles.choicePillActive,
              ]}
              onPress={() => setTemplate(t.id)}
            >
              <Text
                style={
                  template === t.id
                    ? styles.choiceTextActive
                    : styles.choiceText
                }
              >
                {t.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.subTitle}>Typography</Text>
        <View style={styles.rowWrap}>
          {fonts.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[
                styles.choicePill,
                activeFont === f.id && styles.choicePillActive,
              ]}
              onPress={() => setActiveFont(f.id)}
            >
              <Text
                style={[
                  activeFont === f.id
                    ? styles.choiceTextActive
                    : styles.choiceText,
                  { fontFamily: f.family },
                ]}
              >
                Aa
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.subTitle}>Accent Color</Text>
        <View style={styles.colorRow}>
          {brandColors.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorSwatch,
                { backgroundColor: c },
                brandColor === c && styles.colorSwatchActive,
              ]}
              onPress={() => setBrandColor(c)}
            />
          ))}
        </View>

        <Text style={styles.subTitle}>Background Image</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => pickImage(setBgImage)}
          >
            <Text style={styles.uploadBtnText}>
              {bgImage ? "Change Image" : "Upload Image"}
            </Text>
          </TouchableOpacity>
          {bgImage ? (
            <TouchableOpacity
              style={styles.secondaryOutlineBtn}
              onPress={() => setBgImage(null)}
            >
              <Text style={styles.secondaryOutlineText}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {bgImage ? (
          <View style={styles.overlayRow}>
            <Text style={styles.overlayLabel}>Overlay Strength</Text>
            <View style={styles.overlayControls}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() =>
                  setOverlayOpacity((o) => Math.max(0, o - 10))
                }
              >
                <Text style={styles.stepText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.overlayValue}>{overlayOpacity}%</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() =>
                  setOverlayOpacity((o) => Math.min(90, o + 10))
                }
              >
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <Text style={styles.subTitle}>Brand Logo</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => pickImage(setLogoImage)}
          >
            <Text style={styles.uploadBtnText}>
              {logoImage ? "Change Logo" : "Choose File"}
            </Text>
          </TouchableOpacity>
          {logoImage ? (
            <TouchableOpacity
              style={styles.secondaryOutlineBtn}
              onPress={() => setLogoImage(null)}
            >
              <Text style={styles.secondaryOutlineText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Text & Content</Text>
        <Text style={styles.subTitle}>Main Headline</Text>
        <TextInput
          style={styles.input}
          value={headline}
          onChangeText={setHeadline}
        />
        <Text style={styles.subTitle}>Sub-Headline</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={subheadline}
          onChangeText={setSubheadline}
          multiline
        />
        <Text style={styles.subTitle}>Wi-Fi Details (Optional)</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex]}
            placeholder="Network Name"
            value={wifiSsid}
            onChangeText={setWifiSsid}
          />
          <TextInput
            style={[styles.input, styles.flex]}
            placeholder="Password"
            value={wifiPass}
            onChangeText={setWifiPass}
          />
        </View>
      </View>

      <View style={styles.previewWrap}>
        <View style={styles.previewBadge}>
          <Text style={styles.previewBadgeText}>Live Preview</Text>
        </View>

        <ImageBackground
          nativeID="printable-area"
          source={bgImage ? { uri: bgImage.uri } : undefined}
          style={styles.previewCard}
          imageStyle={styles.previewImage}
        >
          {bgImage ? (
            <View
              style={[
                styles.overlay,
                {
                  backgroundColor: template === "dark" ? "#000" : "#fff",
                  opacity: overlayOpacity / 100,
                },
              ]}
            />
          ) : null}
          {template === "framed" ? (
            <View
              style={[styles.frame, { borderColor: brandColor }]}
              pointerEvents="none"
            />
          ) : null}

          <View style={styles.previewContent}>
            <View style={styles.previewLogo}>
                {logoImage ? (
                  <Image
                    source={{ uri: logoImage.uri }}
                    style={styles.logoImage}
                  />
                ) : (
                <Text style={[styles.logoText, { color: cardText }]}>NOIR.</Text>
              )}
            </View>

            <View
              style={[
                styles.qrBox,
                template === "dark" && styles.qrBoxDark,
              ]}
            >
              {qrValue ? (
                <QRCode
                  value={qrValue}
                  size={200}
                  color={template === "dark" ? "#ffffff" : "#000000"}
                  backgroundColor="transparent"
                  getRef={(c) => {
                    qrRef.current = c;
                  }}
                />
              ) : (
                <Text style={styles.emptyQrText}>Select a table to preview</Text>
              )}
              <View style={[styles.scanBadge, { backgroundColor: brandColor }]}>
                <Text style={styles.scanBadgeText}>SCAN ME</Text>
              </View>
            </View>
            {/* Hidden QR generator to ensure dataURL for PDF */}
            {qrValue ? (
              <View style={styles.hiddenQr}>
                <QRCode
                  value={qrValue}
                  size={200}
                  color="#000000"
                  backgroundColor="transparent"
                  getRef={(c) => {
                    printQrRef.current = c;
                  }}
                />
              </View>
            ) : null}

            <View style={styles.previewTextBlock}>
              <Text
                style={[
                  styles.previewHeadline,
                  { color: template === "modern" ? brandColor : cardText },
                  { fontFamily },
                ]}
              >
                {headline}
              </Text>
              <Text
                style={[
                  styles.previewSubheadline,
                  { color: template === "dark" ? "#d1d5db" : "#6b7280" },
                  { fontFamily },
                ]}
              >
                {subheadline}
              </Text>
            </View>

            {wifiSsid ? (
              <View
                style={[
                  styles.wifiBadge,
                  template === "dark" && styles.wifiBadgeDark,
                ]}
              >
                <Text style={styles.wifiLabel}>Free Wi-Fi</Text>
                <Text style={styles.wifiValue}>
                  {wifiSsid}
                  {wifiPass ? ` | ${wifiPass}` : ""}
                </Text>
              </View>
            ) : null}

            <View style={styles.previewFooter}>
              <View>
                <Text style={styles.footerLabel}>Table Number</Text>
                <Text style={styles.footerValue}>
                  {getTableLabel(selectedTable)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.footerLabel}>Zone</Text>
                <Text style={styles.footerZone}>
                  {selectedTable?.zone || "-"}
                </Text>
              </View>
            </View>
          </View>
        </ImageBackground>
      </View>

      <TouchableOpacity style={styles.printBtn} onPress={handlePrint}>
        <Text style={styles.printBtnText}>Print Flyer</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AdminColors.background },
  container: { padding: 16, paddingBottom: 36 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  section: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#eef2f7",
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  sectionHint: { fontSize: 12, color: "#6b7280", marginBottom: 8 },
  subTitle: { fontSize: 12, fontWeight: "700", marginTop: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  flex: { flex: 1 },
  input: {
    backgroundColor: "#f6f8fa",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginTop: 6,
  },
  textArea: { height: 70, textAlignVertical: "top" },
  tableChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginRight: 8,
    alignItems: "center",
    minWidth: 56,
  },
  tableChipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  tableChipText: { fontWeight: "700", color: "#111827" },
  tableChipTextActive: { color: "#fff" },
  tableChipSub: { fontSize: 10, color: "#6b7280" },
  choicePill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  choicePillActive: { backgroundColor: "#111827", borderColor: "#111827" },
  choiceText: { fontSize: 12, color: "#6b7280", fontWeight: "700" },
  choiceTextActive: { fontSize: 12, color: "#fff", fontWeight: "700" },
  colorRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchActive: { borderColor: "#fff", shadowColor: "#000", elevation: 2 },
  uploadBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#111827",
  },
  uploadBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  secondaryOutlineBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  secondaryOutlineText: { fontWeight: "700", fontSize: 12, color: "#6b7280" },
  overlayRow: { marginTop: 10 },
  overlayLabel: { fontSize: 12, color: "#6b7280" },
  overlayControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  overlayValue: { fontWeight: "700" },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontWeight: "700" },
  previewWrap: {
    backgroundColor: "#f3f4f6",
    borderRadius: 16,
    padding: 10,
    marginBottom: 16,
  },
  previewBadge: {
    alignSelf: "flex-end",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  previewBadgeText: { fontSize: 10, fontWeight: "700", color: "#6b7280" },
  previewCard: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  previewImage: { borderRadius: 16 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  frame: {
    position: "absolute",
    inset: 14,
    borderWidth: 3,
    borderRadius: 12,
  },
  previewContent: {
    padding: 18,
    alignItems: "center",
  },
  previewLogo: { height: 40, justifyContent: "center", marginBottom: 12 },
  logoText: { fontSize: 20, fontWeight: "900", letterSpacing: 3 },
  logoImage: { width: 120, height: 40, resizeMode: "contain" },
  qrBox: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  qrBoxDark: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  qrImage: { width: 200, height: 200 },
  hiddenQr: { position: "absolute", opacity: 0, width: 0, height: 0 },
  scanBadge: {
    marginTop: 10,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  scanBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  emptyQrText: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  previewTextBlock: { alignItems: "center", marginBottom: 8 },
  previewHeadline: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  previewSubheadline: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  wifiBadge: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },
  wifiBadgeDark: {
    borderColor: "#374151",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  wifiLabel: { fontSize: 10, color: "#6b7280", fontWeight: "700" },
  wifiValue: { fontSize: 12, fontWeight: "700" },
  previewFooter: {
    width: "100%",
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerLabel: { fontSize: 10, color: "#6b7280", fontWeight: "700" },
  footerValue: { fontSize: 18, fontWeight: "900" },
  footerZone: { fontSize: 12, fontWeight: "700" },
  printBtn: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 24,
  },
  printBtnText: { color: "#fff", fontWeight: "700" },
});
