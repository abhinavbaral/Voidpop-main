// The pages behind the More menu: Statistics, Appearance, Settings,
// Data and storage, Help, About. Same content as the website's /more/* pages.

import { useCallback, useState } from "react";
import {
  ScrollView, View, Text, TextInput, TouchableOpacity, Pressable, Switch, StyleSheet, Share, Alert, Linking, Platform,
} from "react-native";
import { fetchAniListUserList, cacheSize, cacheClear } from "@voidation/shared/api/anilist";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  getUserTier, TIERS, statusesFor, exportData, importData, clearData, storageSize, importAniListEntries,
  getCategories, addCategory, renameCategory, moveCategory, deleteCategory,
} from "@voidation/shared/backend/store";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import TierBadge from "../components/TierBadge.js";
import { useTheme } from "../context/ThemeContext.js";
import { goBackOrHome } from "../lib/nav";
import {
  FREQUENCIES, KEEP, getBackupConfig, setFrequency, chooseFolder, backupNow, restoreFromFile,
} from "../lib/backup";
import { ensurePermission, rescheduleEpisodeAlerts } from "../lib/episodeAlerts";
import AniListSync from "../components/AniListSync.js";
import { timeAgo } from "@voidation/shared/backend/store";

const NATIVE = Platform.OS !== "web";
const AUTO_BACKUP = Platform.OS === "android"; // Android's folder picker (SAF)

const VERSION = "1.0.0";
const TITLES = {
  statistics: "Statistics", appearance: "Appearance", settings: "Settings",
  data: "Data and storage", categories: "Categories", anilist: "AniList", help: "Help", about: "About",
};

export default function MorePageScreen({ route, navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const page = route.params?.page;
  const Body = { statistics: Statistics, appearance: Appearance, settings: Settings, data: DataStorage, categories: Categories, anilist: AniListPage, help: Help, about: About }[page];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => goBackOrHome(navigation)}>
          <Text style={{ color: C.purple, marginBottom: 10 }}>← More</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>{TITLES[page] || "More"}</Text>
        {Body ? <Body styles={styles} C={C} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Statistics({ styles }) {
  const [data, setData] = useState(null);
  useFocusEffect(useCallback(() => { getUserTier().then(setData).catch(() => {}); }, []));
  if (!data) return <Text style={styles.note}>Loading…</Text>;
  const { tier, stats } = data;
  const next = TIERS.find((t) => t.min > stats.totalCompleted);
  return (
    <>
      <View style={styles.statsRow}>
        {[["In library", stats.tracking], ["Completed", stats.totalCompleted], ["Episodes watched", stats.episodesWatched],
          ["Chapters read", stats.chaptersRead], ["Verdicts", stats.verdicts], ["Excited", stats.excited]].map(([l, n]) => (
          <View key={l} style={styles.stat}><Text style={styles.statNum}>{n}</Text><Text style={styles.statLabel}>{l}</Text></View>
        ))}
      </View>
      <View style={styles.card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.cardTitle}>Rank</Text><TierBadge tier={tier} size="lg" />
        </View>
        <Text style={styles.note}>
          {next ? `${next.min - stats.totalCompleted} more completed to reach ${next.label}.` : "Top rank reached."}
        </Text>
      </View>
      {["anime", "manga"].map((seg) => (
        <View key={seg} style={styles.card}>
          <Text style={styles.cardTitle}>
            {seg === "anime" ? "Anime" : "Manga"} trackers <Text style={styles.note}>{stats.inLibrary[seg]} total</Text>
          </Text>
          {statusesFor(seg).map((s) => (
            <View key={s.key} style={styles.trackerRow}>
              <Text style={styles.trackerLabel}>{s.label}</Text>
              <Text style={styles.trackerNum}>{stats.byStatus[seg][s.key] || 0}</Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

function Appearance({ styles }) {
  const { mode, setMode } = useTheme();
  return (
    <View style={styles.modeRow}>
      {[["void", "Void (dark)"], ["pop", "Light"]].map(([k, label]) => (
        <TouchableOpacity key={k} onPress={() => setMode(k)} style={[styles.btn, mode === k && styles.btnOn]}>
          <Text style={[styles.btnText, mode === k && { color: "#fff" }]}>{label}</Text>
        </TouchableOpacity>
      ))}
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

function DataStorage({ styles, C }) {
  const { reload } = useSettings();
  const [size, setSize] = useState(null);
  const [offlineSize, setOfflineSize] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
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

  const pickFolder = () => run(async () => {
    const next = await chooseFolder();
    if (next) {
      await backupNow().catch(() => {}); // first backup right away, so the folder is proven writable
      setMessage("Backups will be saved to that folder.");
    }
  });
  const now = () => run(async () => {
    try { await backupNow(); setMessage("Backup saved."); }
    catch { setMessage("Couldn't write to the backup folder. Choose it again."); }
  });
  const shareBackup = async () => {
    try { await Share.share({ title: "Voidation backup", message: await exportData() }); }
    catch { setMessage("Couldn't open the share sheet."); }
  };
  const restore = () => Alert.alert("Replace your library?", "Everything on this phone will be replaced by the backup you pick.", [
    { text: "Cancel", style: "cancel" },
    { text: "Pick backup file", style: "destructive", onPress: () => run(async () => {
      const err = await restoreFromFile();
      if (err === "cancelled") return;
      setMessage(err || "Library restored from backup.");
      if (!err) { reload(); rescheduleEpisodeAlerts(); }
    }) },
  ]);
  const clear = () => Alert.alert("Clear library?", "Deletes every tracked title, verdict and Excited mark. This can't be undone.", [
    { text: "Cancel", style: "cancel" },
    { text: "Clear", style: "destructive", onPress: async () => {
      await clearData(); setMessage("Library cleared. Your settings were kept."); measure(); rescheduleEpisodeAlerts();
    } },
  ]);

  return (
    <>
      <Text style={styles.note}>
        No account, no sign-in: your library is saved on this phone and stays there until you uninstall the app.
        {AUTO_BACKUP ? " Automatic backups go to a folder you choose, which survives uninstalling." : " Share a backup somewhere safe now and then."}
        {" "}Using {size === null ? "…" : `${(size / 1024).toFixed(1)} KB`}.
      </Text>

      {AUTO_BACKUP && cfg && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Automatic backups</Text>
          <Pressable onPress={pickFolder} disabled={busy} style={styles.trackerRow}>
            <Text style={styles.trackerLabel}>Backup folder</Text>
            <Text style={[styles.trackerNum, { color: cfg.dirUri ? C.text : C.purple, maxWidth: "60%" }]} numberOfLines={1}>
              {cfg.dirUri ? cfg.dirName : "Choose folder"}
            </Text>
          </Pressable>
          <Text style={[styles.trackerLabel, { marginTop: 8 }]}>How often</Text>
          <View style={[styles.modeRow, { flexWrap: "wrap" }]}>
            {FREQUENCIES.map((f) => (
              <TouchableOpacity key={f.key} disabled={busy}
                style={[styles.chip, cfg.freq === f.key && styles.btnOn]}
                onPress={async () => { setCfg(await setFrequency(f.key)); }}>
                <Text style={[styles.btnText, cfg.freq === f.key && { color: "#fff" }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.note, { marginTop: 10 }]}>
            {cfg.lastError ? cfg.lastError
              : cfg.last ? `Last backup ${timeAgo(cfg.last)}. The newest ${KEEP} are kept.`
              : cfg.dirUri ? "No backup yet." : "Pick a folder like Download/Voidation. Backups run in the background, and when you open the app."}
          </Text>
          <TouchableOpacity style={[styles.btn, { marginTop: 10, flex: undefined }]} disabled={!cfg.dirUri || busy} onPress={now}>
            <Text style={[styles.btnText, !cfg.dirUri && { color: C.faint }]}>Back up now</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Manual backup</Text>
        <Text style={styles.note}>Send a copy anywhere, or restore from any Voidation backup file (from this phone, another phone, or the website).</Text>
        <View style={[styles.modeRow, { marginTop: 10 }]}>
          <TouchableOpacity style={styles.btn} onPress={shareBackup}>
            <Text style={styles.btnText}>Share backup</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnOn]} disabled={busy} onPress={restore}>
            <Text style={[styles.btnText, { color: "#fff" }]}>Restore from file</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Offline copy</Text>
        <Text style={styles.note}>
          The latest schedules and titles are saved as you browse, so Voidation still works without internet.
          Using {offlineSize === null ? "…" : `${(offlineSize / 1024).toFixed(0)} KB`}. Clearing it doesn't touch your library.
        </Text>
        <TouchableOpacity style={[styles.btn, { marginTop: 10, flex: undefined }]}
          onPress={async () => { await cacheClear(); setMessage("Offline copy cleared."); measure(); }}>
          <Text style={styles.btnText}>Clear offline copy</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Clear data</Text>
        <Text style={styles.note}>Removes every tracked title, verdict and Excited mark from this phone.</Text>
        <TouchableOpacity style={[styles.btn, { marginTop: 10, flex: undefined, borderColor: C.rose }]} onPress={clear}>
          <Text style={[styles.btnText, { color: C.rose }]}>Clear library</Text>
        </TouchableOpacity>
      </View>
      {!!message && <Text style={[styles.note, { marginTop: 12 }]}>{message}</Text>}
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

// Your own Library groups ("Favourites", "Rewatch", "With friends"…), like
// Mihon's categories. Titles can be in several; deleting one keeps the titles.
function Categories({ styles, C }) {
  const [cats, setCats] = useState(null);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null); // { id, name }
  const [message, setMessage] = useState("");
  const refresh = useCallback(() => { getCategories().then(setCats); }, []);
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
                  <Text style={[styles.trackerLabel, { flex: 1, color: C.text, fontWeight: "700" }]}>{c.name}</Text>
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
});
