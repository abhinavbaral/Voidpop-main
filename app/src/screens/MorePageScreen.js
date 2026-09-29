// The pages behind the More menu: Statistics, Appearance, Settings,
// Data and storage, Help, About. Same content as the website's /more/* pages.

import { useCallback, useState } from "react";
import {
  ScrollView, View, Text, TextInput, TouchableOpacity, Pressable, Switch, StyleSheet, Share, Alert, Linking, Platform, Image,
} from "react-native";
import { fetchAniListUserList, cacheSize, cacheClear } from "@voidation/shared/api/anilist";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  getUserTier, TIERS, statusesFor, exportData, importData, clearData, storageSize, importAniListEntries,
  getCategories, addCategory, renameCategory, moveCategory, deleteCategory,
  getExcited, toggleExcited, celebrate, getSpotlight, setSpotlight, SPOTLIGHT_MIN, exportLibraryCsv,
} from "@voidation/shared/backend/store";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import TierBadge from "../components/TierBadge.js";
import { useTheme } from "../context/ThemeContext.js";
import { goBackOrHome, openDetail } from "../lib/nav";
import { loadAnnounced, daysLeft, ANNOUNCED_DAYS } from "@voidation/shared/announced";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import { releaseLabel, durationLabel } from "@voidation/shared/format";
import {
  FREQUENCIES, KEEP, getBackupConfig, setFrequency, chooseFolder, backupNow, restoreFromFile,
} from "../lib/backup";
import { ensurePermission, rescheduleEpisodeAlerts } from "../lib/episodeAlerts";
import AniListSync from "../components/AniListSync.js";
import OptionsSheet from "../components/OptionsSheet.js";
import * as Sharing from "expo-sharing";
import { cacheDirectory, writeAsStringAsync } from "expo-file-system/legacy";
import { timeAgo } from "@voidation/shared/backend/store";

const NATIVE = Platform.OS !== "web";
const AUTO_BACKUP = Platform.OS === "android"; // Android's folder picker (SAF)

const VERSION = "1.0.0";
const TITLES = {
  statistics: "Statistics", appearance: "Settings", settings: "Settings",
  data: "Data and storage", announced: "New announcements", badge: "Your badge", categories: "Categories", anilist: "AniList", help: "Help", about: "About",
};

export default function MorePageScreen({ route, navigation }) {
  const nav = navigation;
  const { C } = useTheme();
  const styles = makeStyles(C);
  const page = route.params?.page;
  const Body = { statistics: Statistics, settings: Settings, appearance: Settings, data: DataStorage, categories: Categories, anilist: AniListPage, announced: Announced, badge: BadgePage, help: Help, about: About }[page];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => goBackOrHome(navigation)}>
          <Text style={{ color: C.purple, marginBottom: 10 }}>← More</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>{TITLES[page] || "More"}</Text>
        {Body ? <Body styles={styles} C={C} navigation={nav} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// Statistics, laid out like Mihon's: Overview, Anime, Chapters, then trackers.
function Statistics({ styles, C }) {
  const [data, setData] = useState(null);
  useFocusEffect(useCallback(() => { getUserTier().then(setData).catch(() => {}); }, []));
  if (!data) return <Text style={styles.note}>Loading…</Text>;
  const { stats } = data;
  const fmt = (n) => (n || 0).toLocaleString();
  const block = (title, cells) => (
    <View style={{ marginTop: 14 }}>
      <Text style={{ color: C.purple, fontWeight: "700", fontSize: 14, marginBottom: 8 }}>{title}</Text>
      <View style={[styles.card, { marginTop: 0, flexDirection: "row", paddingVertical: 16, paddingHorizontal: 6 }]}>
        {cells.map(([n, label]) => (
          <View key={label} style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "800" }}>{n}</Text>
            <Text style={{ color: C.sub, fontSize: 11, textAlign: "center" }}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
  return (
    <>
      {block("Overview", [[fmt(stats.tracking), "In library"], [fmt(stats.totalCompleted), "Completed & finished"], [durationLabel(stats.minutesWatched), "Time watched"]])}
      {block("Anime", [[fmt(stats.episodesTotal), "Total"], [fmt(stats.episodesWatched), "Watched"], [fmt(stats.inLibrary.anime), "Entries"]])}
      {block("Chapters", [[fmt(stats.chaptersTotal), "Total"], [fmt(stats.chaptersRead), "Read"], [fmt(stats.inLibrary.manga), "Entries"]])}
      <Text style={{ color: C.purple, fontWeight: "700", fontSize: 14, marginTop: 14 }}>Trackers</Text>
      {["anime", "manga"].map((seg) => (
        <View key={seg} style={styles.card}>
          <Text style={styles.cardTitle}>{seg === "anime" ? "Anime" : "Manga"}</Text>
          {statusesFor(seg).map((st) => (
            <View key={st.key} style={styles.trackerRow}>
              <Text style={styles.trackerLabel}>{st.label}</Text>
              <Text style={styles.trackerNum}>{stats.byStatus[seg][st.key] || 0}</Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

// Theme, like Mihon: System / Light / Dark, plus Pure black for dark.
function ThemeSettings({ styles, C }) {
  const { pref, setPref, pureBlack, setPureBlack, dark } = useTheme();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Theme</Text>
      <View style={[styles.modeRow, { marginTop: 10 }]}>
        {[["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([k, label]) => (
          <TouchableOpacity key={k} onPress={() => setPref(k)} style={[styles.btn, pref === k && styles.btnOn]}>
            <Text style={[styles.btnText, pref === k && { color: "#fff" }]}>{pref === k ? "✓ " : ""}{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Pressable style={[styles.toggleRow, { marginTop: 8 }]} onPress={() => setPureBlack(!pureBlack)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Pure black dark mode</Text>
          <Text style={styles.note}>{dark ? "A fully black background (saves battery on OLED screens)" : "Used when the theme is dark"}</Text>
        </View>
        <Switch value={pureBlack} onValueChange={setPureBlack} trackColor={{ false: C.border, true: C.purple }} thumbColor="#fff" />
      </Pressable>
    </View>
  );
}

function Settings({ styles, C }) {
  const { settings, update } = useSettings();
  const row = (key, label, hint) => (
    <Pressable key={key} style={styles.toggleRow} onPress={() => update(key, !settings[key])}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{label}</Text>
        <Text style={styles.note}>{hint}</Text>
      </View>
      <Switch value={settings[key]} onValueChange={(v) => update(key, v)} trackColor={{ false: C.border, true: C.purple }} thumbColor="#fff" />
    </Pressable>
  );
  return (
    <>
    <ThemeSettings styles={styles} C={C} />
    <View style={styles.card}>
      {row("clock24", "24-hour clock", "Airing times as 16:30 instead of 4:30 PM")}
      {row("posterBadges", "Countdown badges on posters", 'Shows "Ep 7 · 3h 30m" on airing anime')}
      {NATIVE && (
        <Pressable style={styles.toggleRow} onPress={() => toggleAlerts(!settings.notifyEpisodes)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>New episode alerts</Text>
            <Text style={styles.note}>
              A notification when an episode airs, for anime you mark Watching, Plan to Watch, On Hold or Excited
            </Text>
          </View>
          <Switch value={settings.notifyEpisodes} onValueChange={toggleAlerts} trackColor={{ false: C.border, true: C.purple }} thumbColor="#fff" />
        </Pressable>
      )}
    </View>
    </>
  );

  async function toggleAlerts(on) {
    if (on && !(await ensurePermission())) {
      Alert.alert("Notifications are off", "Allow notifications for Voidation in your phone's settings, then turn this on again.", [
        { text: "Not now", style: "cancel" },
        { text: "Open settings", onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    await update("notifyEpisodes", on);
    rescheduleEpisodeAlerts();
  }
}

// Data and storage, laid out like Mihon's: storage location, Create / Restore
// backup, automatic backup frequency, storage usage, offline copy, export.
function DataStorage({ styles, C }) {
  const { reload } = useSettings();
  const [size, setSize] = useState(null);
  const [offlineSize, setOfflineSize] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [freqOpen, setFreqOpen] = useState(false);
  const measure = useCallback(() => {
    storageSize().then(setSize);
    cacheSize().then(setOfflineSize);
    if (AUTO_BACKUP) getBackupConfig().then(setCfg);
  }, []);
  useFocusEffect(measure);

  const run = async (fn) => {
    setBusy(true);
    setMessage("");
    try { await fn(); } finally { setBusy(false); measure(); }
  };
  const kb = (n) => (n === null ? "…" : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);

  const pickFolder = () => run(async () => {
    const next = await chooseFolder();
    if (next) {
      await backupNow().catch(() => {}); // first backup right away, so the folder is proven writable
      setMessage("Backups will be saved to that folder.");
    }
  });
  const shareFile = async (name, text, mime) => {
    const uri = `${cacheDirectory}${name}`;
    await writeAsStringAsync(uri, text);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: name });
    else await Share.share({ title: name, message: text });
  };
  // Create backup: into your backup folder if you've chosen one, otherwise share the file
  const create = () => run(async () => {
    try {
      if (cfg?.dirUri) { await backupNow(); setMessage("Backup saved to your backup folder."); }
      else await shareFile(`voidation-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportData(), "application/json");
    } catch { setMessage("Couldn't create the backup. Choose the backup folder again."); }
  });
  const restore = () => Alert.alert("Replace your library?", "Everything on this phone will be replaced by the backup you pick.", [
    { text: "Cancel", style: "cancel" },
    { text: "Pick backup file", style: "destructive", onPress: () => run(async () => {
      const err = await restoreFromFile();
      if (err === "cancelled") return;
      setMessage(err || "Library restored from backup.");
      if (!err) { reload(); rescheduleEpisodeAlerts(); }
    }) },
  ]);
  const exportList = () => run(async () => {
    try { await shareFile(`voidation-library-${new Date().toISOString().slice(0, 10)}.csv`, await exportLibraryCsv(), "text/csv"); }
    catch { setMessage("Couldn't export the list."); }
  });
  const clear = () => Alert.alert("Clear library?", "Deletes every tracked title, verdict and Excited mark. This can't be undone.", [
    { text: "Cancel", style: "cancel" },
    { text: "Clear", style: "destructive", onPress: async () => {
      await clearData(); setMessage("Library cleared. Your settings were kept."); measure(); rescheduleEpisodeAlerts();
    } },
  ]);

  const Section = ({ children }) => <Text style={{ color: C.purple, fontWeight: "700", fontSize: 14, marginTop: 22, marginBottom: 6 }}>{children}</Text>;
  const Row = ({ title, sub, onPress, right, danger }) => (
    <Pressable onPress={onPress} disabled={!onPress || busy} style={({ pressed }) => [{ paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }, pressed && { opacity: 0.6 }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? C.rose : C.text, fontSize: 16 }}>{title}</Text>
        {!!sub && <Text style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>{sub}</Text>}
      </View>
      {right}
    </Pressable>
  );
  const freqLabel = FREQUENCIES.find((f) => f.key === cfg?.freq)?.label || "Off";
  const offlineShare = offlineSize ? Math.min(1, offlineSize / 1_500_000) : 0;

  return (
    <>
      {AUTO_BACKUP && cfg && (
        <>
          <Row title="Storage location" sub={cfg.dirUri ? cfg.dirName : "Tap to choose a folder, e.g. Download/Voidation"} onPress={pickFolder} />
          <Text style={{ color: C.faint, fontSize: 18 }}>ⓘ</Text>
          <Text style={[styles.note, { fontSize: 13, marginTop: 4 }]}>Used for automatic backups. A folder you choose survives uninstalling the app.</Text>
        </>
      )}

      <Section>Backup and restore</Section>
      <View style={styles.segmented}>
        <TouchableOpacity style={[styles.segBtn, { borderRightWidth: 1, borderRightColor: C.border }]} onPress={create} disabled={busy}>
          <Text style={styles.segText}>Create backup</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.segBtn} onPress={restore} disabled={busy}>
          <Text style={styles.segText}>Restore backup</Text>
        </TouchableOpacity>
      </View>
      {AUTO_BACKUP && cfg && (
        <Row title="Automatic backup frequency" sub={freqLabel} onPress={() => setFreqOpen(true)} />
      )}
      <Text style={{ color: C.faint, fontSize: 18, marginTop: 4 }}>ⓘ</Text>
      <Text style={[styles.note, { fontSize: 13, marginTop: 4 }]}>
        You should keep copies of backups in other places as well. Backups hold your whole library, verdicts and watch log.
      </Text>
      {AUTO_BACKUP && cfg && (
        <Text style={[styles.note, { fontSize: 13, marginTop: 10 }]}>
          {cfg.lastError ? cfg.lastError : cfg.last ? `Last automatically backed up: ${timeAgo(cfg.last)}` : cfg.dirUri ? "No automatic backup yet." : "Choose a storage location to turn on automatic backups."}
        </Text>
      )}

      <Section>Storage usage</Section>
      <Text style={{ color: C.text, fontSize: 16, fontWeight: "700" }}>On this phone</Text>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: C.card, overflow: "hidden", flexDirection: "row", marginTop: 10 }}>
        <View style={{ width: `${Math.max(2, offlineShare * 100)}%`, backgroundColor: C.purple, borderRadius: 5 }} />
      </View>
      <Text style={[styles.note, { fontSize: 13, marginTop: 6 }]}>Library: {kb(size)} · Offline copy: {kb(offlineSize)} of 1.5 MB</Text>
      <Row title="Clear offline copy" sub={`Used: ${kb(offlineSize)}. Your library isn't touched.`}
        onPress={async () => { await cacheClear(); setMessage("Offline copy cleared."); measure(); }} />

      <Section>Export</Section>
      <Row title="Library list" sub="Every title as a spreadsheet (CSV): status, progress, verdict, categories" onPress={exportList} />

      <Section>Danger zone</Section>
      <Row title="Clear library" sub="Removes every tracked title, verdict and Excited mark from this phone" onPress={clear} danger />
      {!!message && <Text style={[styles.note, { marginTop: 12 }]}>{message}</Text>}

      <OptionsSheet
        visible={freqOpen}
        title="Automatic backup frequency"
        options={FREQUENCIES.map((f) => ({ key: f.key, label: `${cfg?.freq === f.key ? "✓  " : ""}${f.label}` }))}
        onPick={async (k) => { setFreqOpen(false); setCfg(await setFrequency(k)); }}
        onClose={() => setFreqOpen(false)}
      />
    </>
  );
}

// Bring your AniList anime and manga lists over, by username. Nothing is
// written to AniList, and no password or key is needed (lists must be public).
function AniListImport({ styles, C, onDone }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const go = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setResult("");
    try {
      const r = await importAniListEntries(await fetchAniListUserList(name));
      setResult(`Imported from AniList: ${r.added} added, ${r.updated} updated${r.kept ? `, ${r.kept} kept as they were (changed more recently here)` : ""}.`);
      onDone();
    } catch (e) {
      setResult(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Import from AniList</Text>
      <Text style={styles.note}>
        Adds your AniList anime and manga with their status and progress. A title that's already here keeps whichever
        copy was changed last. Nothing is changed on AniList, and your lists need to be public.
      </Text>
      <View style={[styles.modeRow, { marginTop: 10 }]}>
        <TextInput value={name} onChangeText={setName} placeholder="AniList username" placeholderTextColor={C.faint}
          autoCapitalize="none" autoCorrect={false} onSubmitEditing={go} returnKeyType="go"
          style={[styles.btn, { color: C.text, paddingHorizontal: 12, flex: 2, alignItems: undefined }]} />
        <TouchableOpacity style={[styles.btn, styles.btnOn, (!name.trim() || busy) && { opacity: 0.5 }]} onPress={go} disabled={!name.trim() || busy}>
          <Text style={[styles.btnText, { color: "#fff" }]}>{busy ? "Importing…" : "Import"}</Text>
        </TouchableOpacity>
      </View>
      {!!result && <Text style={[styles.note, { marginTop: 8 }]}>{result}</Text>}
    </View>
  );
}

// Your rank, progress to the next, and every badge (locked ones greyed out).
// Tap an earned badge to replay its celebration.
function BadgePage({ styles, C }) {
  const [data, setData] = useState(null);
  useFocusEffect(useCallback(() => { getUserTier().then(setData).catch(() => {}); }, []));
  if (!data) return <Text style={styles.note}>Loading…</Text>;
  const { tier, stats } = data;
  const n = stats.totalCompleted;
  const next = TIERS.find((t) => t.min > n);
  const pct = next ? Math.round(((n - tier.min) / (next.min - tier.min)) * 100) : 100;
  const medal = (t, earned, size) => (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: size / 11, borderColor: earned ? t.color : C.border,
      backgroundColor: "#171226", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: earned ? t.color : C.faint, fontSize: size / 3.2 }}>{earned ? (t.key === "addicted" ? "☕" : "★") : "🔒"}</Text>
    </View>
  );
  return (
    <>
      <View style={[styles.card, { alignItems: "center", gap: 8 }]}>
        {medal(tier, true, 130)}
        <Text style={{ color: tier.color, fontWeight: "900", fontSize: 20, marginTop: 6 }}>{tier.label.toUpperCase()}</Text>
        <Text style={[styles.cardTitle, { fontSize: 18, textAlign: "center" }]}>{tier.title}</Text>
        <Text style={styles.note}>{stats.anime} anime completed · {stats.manga} manga finished</Text>
        {next ? (
          <>
            <View style={{ width: "100%", height: 8, borderRadius: 4, backgroundColor: C.border, overflow: "hidden", marginTop: 6 }}>
              <View style={{ width: `${pct}%`, height: "100%", backgroundColor: tier.color }} />
            </View>
            <Text style={styles.note}>{next.min - n} more to <Text style={{ color: next.color, fontWeight: "800" }}>{next.label}</Text> ({n} of {next.min})</Text>
          </>
        ) : <Text style={styles.note}>You've reached the top rank. Maybe take a break.</Text>}
      </View>
      {TIERS.map((t) => {
        const earned = n >= t.min;
        return (
          <TouchableOpacity key={t.key} disabled={!earned} onPress={() => celebrate(t)}
            style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, opacity: earned ? 1 : 0.5 }]}>
            {medal(t, earned, 44)}
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, earned && { color: t.color }]}>{t.label}</Text>
              <Text style={styles.note}>{t.min === 0 ? "Where everyone starts" : `${t.min} anime completed + manga finished`}</Text>
            </View>
            <Text style={styles.note}>{earned ? "Earned ▸" : `${t.min - n} to go`}</Text>
          </TouchableOpacity>
        );
      })}
    </>
  );
}

// Anime announced on AniList this week. Each stays 7 days, then drops off.
function Announced({ styles, C, navigation }) {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [excited, setExcited] = useState({});
  useFocusEffect(useCallback(() => {
    loadAnnounced().then(setList).catch(() => setList([]));
    getExcited().then(setExcited);
  }, []));
  if (!list) return <Text style={styles.note}>Loading…</Text>;
  if (!list.length) return <Text style={styles.note}>No new announcements in the last {ANNOUNCED_DAYS} days.</Text>;
  return (
    <>
      <Text style={styles.note}>Anime newly announced on AniList. Each one stays here for {ANNOUNCED_DAYS} days. Tap Excited to get it on your Schedule.</Text>
      <View style={[styles.card, { paddingVertical: 6 }]}>
        {list.map(({ item, seenAt }, i) => {
          const on = !!excited[`anime:${item.id}`];
          const left = daysLeft(seenAt);
          return (
            <View key={item.id} style={[{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
              <TouchableOpacity style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }} onPress={() => openDetail(navigation, item)}>
                {item.image ? <Image source={{ uri: item.image }} style={{ width: 38, height: 54, borderRadius: 6 }} /> : <View style={{ width: 38, height: 54, borderRadius: 6, backgroundColor: C.border }} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.note} numberOfLines={1}>
                    {item.date ? releaseLabel(item) : "Release date TBA"}{item.creator ? ` · ${item.creator}` : ""}
                  </Text>
                  <Text style={[styles.note, { fontSize: 10 }]}>{left} day{left === 1 ? "" : "s"} left here</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={async () => { await toggleExcited(user, item); setExcited(await getExcited()); }}
                style={{ borderWidth: 1, borderColor: C.orange, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: on ? C.orange : "transparent" }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: on ? "#fff" : C.orange }}>{on ? "Excited ✓" : "Excited?"}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </>
  );
}

// Your own Library groups ("Favourites", "Rewatch", "With friends"…), like
// Mihon's categories. Titles can be in several; deleting one keeps the titles.
function Categories({ styles, C }) {
  const [cats, setCats] = useState(null);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null); // { id, name }
  const [message, setMessage] = useState("");
  const [spot, setSpot] = useState(null);
  const refresh = useCallback(() => { getCategories().then(setCats); getSpotlight().then(setSpot); }, []);
  useFocusEffect(refresh);

  const add = async () => {
    const cat = await addCategory(name);
    setMessage(cat ? "" : name.trim() ? "You already have a category with that name." : "");
    if (cat) setName("");
    refresh();
  };
  const remove = (c) => Alert.alert(`Delete "${c.name}"?`, "The titles in it stay in your library.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => { await deleteCategory(c.id); refresh(); } },
  ]);
  if (!cats) return <Text style={styles.note}>Loading…</Text>;
  return (
    <>
      <Text style={styles.note}>
        Group titles your own way: Favourites, Rewatch, With friends… A title can be in several. Filter by them in the
        Library; add titles from a title's page, or long-press in the Library to select several.
      </Text>
      <View style={[styles.modeRow, { marginTop: 12 }]}>
        <TextInput value={name} onChangeText={setName} placeholder="New category" placeholderTextColor={C.faint} maxLength={40}
          onSubmitEditing={add} returnKeyType="done"
          style={[styles.btn, { color: C.text, paddingHorizontal: 12, flex: 2, alignItems: undefined }]} />
        <TouchableOpacity style={[styles.btn, styles.btnOn, !name.trim() && { opacity: 0.5 }]} disabled={!name.trim()} onPress={add}>
          <Text style={[styles.btnText, { color: "#fff" }]}>Add</Text>
        </TouchableOpacity>
      </View>
      {!!message && <Text style={{ color: C.rose, fontSize: 12, marginTop: 6 }}>{message}</Text>}
      {spot && (
        <View style={[styles.card, { borderColor: C.amber, opacity: spot.unlocked ? 1 : 0.8 }]}>
          <Text style={styles.cardTitle}>⭐ Spotlight {spot.unlocked ? "" : "🔒"}</Text>
          <Text style={[styles.note, { marginTop: 4 }]}>
            {spot.unlocked
              ? `Tap Spotlight on a category below to make it the top row of Explore during the third week of every month (days 15–21). ${spot.cat ? `Now: ${spot.cat.name}.` : "None picked yet."}`
              : `A reward for serious watchers: complete ${SPOTLIGHT_MIN} anime and one of your categories can be the top row of Explore during the third week of every month. ${spot.needed} to go (${spot.animeCompleted} completed).`}
          </Text>
          {spot.unlocked && spot.cat && (
            <Text style={{ color: C.purple, fontWeight: "800", marginTop: 6 }} onPress={async () => { await setSpotlight(null); refresh(); }}>Turn off</Text>
          )}
        </View>
      )}
      {cats.length === 0 ? <Text style={[styles.note, { marginTop: 16 }]}>No categories yet.</Text> : (
        <View style={styles.card}>
          {cats.map((c, i) => (
            <View key={c.id} style={[styles.trackerRow, i === 0 && { borderTopWidth: 0, marginTop: 0 }, { alignItems: "center", gap: 10 }]}>
              {editing?.id === c.id ? (
                <>
                  <TextInput value={editing.name} autoFocus maxLength={40} onChangeText={(t) => setEditing({ ...editing, name: t })}
                    style={[styles.btn, { color: C.text, paddingHorizontal: 10, flex: 1, alignItems: undefined, height: 36 }]} />
                  <Text style={{ color: C.purple, fontWeight: "800" }}
                    onPress={async () => { await renameCategory(c.id, editing.name); setEditing(null); refresh(); }}>Save</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.trackerLabel, { flex: 1, color: C.text, fontWeight: "700" }]}>
                    {c.name}{spot?.cat?.id === c.id ? <Text style={{ color: C.amber }}>  ⭐</Text> : null}
                  </Text>
                  {spot?.unlocked && spot?.cat?.id !== c.id && (
                    <Text style={{ color: C.amber, fontWeight: "700" }} onPress={async () => { await setSpotlight(c.id); refresh(); }}>Spotlight</Text>
                  )}
                  <Text style={{ color: i === 0 ? C.border : C.sub, fontSize: 16 }} onPress={i === 0 ? undefined : async () => { await moveCategory(c.id, -1); refresh(); }}>↑</Text>
                  <Text style={{ color: i === cats.length - 1 ? C.border : C.sub, fontSize: 16 }} onPress={i === cats.length - 1 ? undefined : async () => { await moveCategory(c.id, 1); refresh(); }}>↓</Text>
                  <Text style={{ color: C.purple, fontWeight: "700" }} onPress={() => setEditing({ id: c.id, name: c.name })}>Rename</Text>
                  <Text style={{ color: C.rose, fontWeight: "700" }} onPress={() => remove(c)}>Delete</Text>
                </>
              )}
            </View>
          ))}
        </View>
      )}
    </>
  );
}

// AniList: two-way sync (sign in) or a one-time import by username.
function AniListPage({ styles, C }) {
  const { reload } = useSettings();
  return (
    <>
      <AniListSync styles={styles} C={C} onChange={() => { reload(); rescheduleEpisodeAlerts(); }} />
      <AniListImport styles={styles} C={C} onDone={() => { reload(); rescheduleEpisodeAlerts(); }} />
    </>
  );
}

const FAQ = [
  ["Where is my library saved?", "On this phone. There is no account and nothing is uploaded. Use Data and storage to back it up."],
  ["How do I move to a new phone?", "Copy a backup file from your backup folder (or Share backup), then use Restore from file on the new phone."],
  ["Can I bring my AniList lists?", "Yes, two ways under More → AniList: sign in to keep them in sync both ways, or import once by username (public lists; nothing is changed on AniList)."],
  ["What does Delayed mean?", "The next episode was going to air earlier, and its date has since moved later. Voidation shows the original date next to the new one."],
  ["Does uninstalling delete my library?", "The library inside the app, yes. Backups in the folder you chose under Data and storage stay, so you can restore them after reinstalling."],
  ["Why didn't I get an episode alert?", "Alerts are set up when you open Voidation and about hourly in the background, for the next episode of everything you follow. Check that notifications are allowed and New episode alerts is on in Settings. Some phones (Xiaomi, Oppo, Vivo…) stop background work to save battery; allow Voidation to run in the background in your phone's battery settings."],
  ["Why doesn't a show have a countdown?", "It has finished airing, or AniList doesn't know the next episode's date yet. Countdowns appear as soon as a date is announced."],
  ["What time zone are the airing times in?", "Yours. Voidation converts every broadcast time to your phone's time zone."],
  ["What shows up in History?", "Episodes from the last 14 days for anime you mark Watching, Plan to Watch, On Hold, or Excited."],
  ["Why no movies or web series?", "Voidation focuses on anime and manga, which AniList provides for free."],
];

function Help({ styles }) {
  const [open, setOpen] = useState(null);
  return FAQ.map(([q, a], i) => (
    <Pressable key={q} style={styles.card} onPress={() => setOpen(open === i ? null : i)}>
      <Text style={styles.cardTitle}>{q}</Text>
      {open === i && <Text style={[styles.note, { marginTop: 6 }]}>{a}</Text>}
    </Pressable>
  ));
}

function About({ styles }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Voidation <Text style={styles.note}>version {VERSION}</Text></Text>
      <Text style={[styles.note, { marginTop: 8 }]}>
        An anime and manga tracker with live countdowns to the next episode. Website and Android app, one codebase, no sign-up.
      </Text>
      <Text style={[styles.note, { marginTop: 8 }]} onPress={() => Linking.openURL("https://abhinavbaral.com.np")}>
        Made by Abhinav Baral in Jhapa, Nepal →
      </Text>
      <Text style={[styles.note, { marginTop: 8 }]} onPress={() => Linking.openURL("https://anilist.co")}>
        Anime and manga data from AniList. Voidation is not affiliated with AniList.
      </Text>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, width: "100%", maxWidth: 720, alignSelf: "center" },
  heading: { color: C.text, fontSize: 22, fontWeight: "800", marginBottom: 8 },
  note: { color: C.faint, fontSize: 12, lineHeight: 17 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  stat: {
    width: "48%", backgroundColor: C.card, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, alignItems: "center", paddingVertical: 12,
  },
  statNum: { color: C.text, fontSize: 20, fontWeight: "800" },
  statLabel: { color: C.faint, fontSize: 11, marginTop: 2 },
  card: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16, marginTop: 12 },
  cardTitle: { color: C.text, fontWeight: "700", fontSize: 14 },
  trackerRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border, marginTop: 4 },
  trackerLabel: { color: C.sub, fontSize: 13 },
  trackerNum: { color: C.text, fontSize: 13, fontWeight: "800" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  btn: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  btnOn: { backgroundColor: C.purple, borderColor: C.purple },
  btnText: { color: C.sub, fontWeight: "800", fontSize: 13 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 7 },
  segmented: { flexDirection: "row", borderWidth: 1, borderColor: C.sub, borderRadius: 999, overflow: "hidden", marginTop: 4 },
  segBtn: { flex: 1, height: 52, alignItems: "center", justifyContent: "center" },
  segText: { color: C.text, fontWeight: "700", fontSize: 15 },
});
