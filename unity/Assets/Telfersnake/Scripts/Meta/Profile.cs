using System.Collections.Generic;
using System.Runtime.InteropServices;
using Telfer.Net;
using Telfer.Sim;
using UnityEngine;

namespace Telfer.Meta
{
    /// <summary>
    /// What the player keeps between runs: stars and blue gems, what they have bought and are wearing,
    /// where and how they last played, and the unlocks. It is the web game's own save (save.ts), in its
    /// format and under its key, so the remaster and the web game share one wallet: in a browser that is
    /// localStorage on the same site; elsewhere PlayerPrefs holds the same JSON.
    /// </summary>
    public sealed class Profile
    {
        public int stars;
        public int gems;
        public List<string> owned = new List<string>(FREE);
        public string skin = "telfer", hat = "no-hat", trail = "no-trail";
        public int bestScore;
        public float bestLength;
        public int runs;
        public string mode = "Easy";
        public string stage = "School";
        public bool commonUnlocked;
        /// <summary>Reached MEGA in a Normal game: half of God mode's key.</summary>
        public bool mega;
        public bool godRevealed, commonSeen;
        /// <summary>The name other players see over your head (from the shuffle, or typed and cleaned).</summary>
        public string name = "";

        /// <summary>The one-off star ticket to the Common.</summary>
        public const int COMMON_COST = 300;
        const string KEY = "telfersnake.save.v1";
        /// <summary>Where this remaster kept its own save before it shared the web game's.</summary>
        const string OLD_KEY = "telfersnake-profile";
        static readonly string[] FREE = { "telfer", "no-hat", "no-trail" };
        const int MAX_COUNT = 9_999_999;

        /// <summary>Everything as read from storage, the web game's own fields (audio, dashed…) included, written back untouched.</summary>
        Dictionary<string, object> disk = new Dictionary<string, object>();
        /// <summary>Stars, gems and owned items as of the last time this game and the storage agreed (save.ts).</summary>
        int syncedStars, syncedGems;
        List<string> syncedOwned = new List<string>(FREE);

        static Profile current;
        public static Profile I => current ?? (current = Load());

        static Profile Load()
        {
            var p = Read();
            if (p == null)
            {
                // Nothing shared yet: bring over this remaster's own save once, if it had one.
                // Synced counts stay at nothing, so the merge adds all of it to the empty storage.
                p = FromOld(Store.Get(OLD_KEY)) ?? new Profile();
                p.name = Names.Clean(p.name) ?? Names.Random();
                p.Save();
                return p;
            }
            p.Adopt();
            // A fresh random name is kept, so the other players see the same one next time.
            if (Json.Str(p.disk, "name") != p.name) p.Save();
            return p;
        }

        /// <summary>Remember this as what the storage holds now, for the next merge.</summary>
        void Adopt()
        {
            syncedStars = stars;
            syncedGems = gems;
            syncedOwned = new List<string>(owned);
        }

        /// <summary>
        /// Save without clobbering the web game in another tab, as save.ts does: only this game's changes
        /// since the last sync go on top of whatever is stored now, so neither undoes the other's stars,
        /// gems or buys. Unlocks are sticky and bests only go up.
        /// </summary>
        public void Save()
        {
            var now = Read() ?? new Profile();
            var added = owned.FindAll(id => !syncedOwned.Contains(id));
            var removed = syncedOwned.FindAll(id => !owned.Contains(id));
            var merged = new List<string>(now.owned);
            foreach (var id in added) if (!merged.Contains(id)) merged.Add(id);
            merged.RemoveAll(id => removed.Contains(id));

            stars = Mathf.Max(0, now.stars + (stars - syncedStars));
            gems = Mathf.Max(0, now.gems + (gems - syncedGems));
            owned = merged;
            bestScore = Mathf.Max(bestScore, now.bestScore);
            bestLength = Mathf.Max(bestLength, now.bestLength);
            runs = Mathf.Max(runs, now.runs);
            mega |= now.mega;
            commonUnlocked |= now.commonUnlocked;
            godRevealed |= now.godRevealed;
            commonSeen |= now.commonSeen;

            // The stored object as it is, with ours written over it: fields only the web game knows stay.
            var d = new Dictionary<string, object>(now.disk);
            d["stars"] = stars;
            d["owned"] = owned;
            d["skin"] = skin;
            d["hat"] = hat;
            d["trail"] = trail;
            d["name"] = name;
            d["bestScore"] = bestScore;
            d["bestLength"] = bestLength;
            d["runs"] = runs;
            d["gems"] = gems;
            d["mode"] = mode.ToLowerInvariant();
            d["stage"] = stage.ToLowerInvariant();
            d["commonUnlocked"] = commonUnlocked;
            d["mega"] = mega;
            d["godRevealed"] = godRevealed;
            d["commonSeen"] = commonSeen;
            // Only once it is safely stored does this game adopt the merged picture.
            if (!Store.Set(KEY, Json.Write(d))) return;
            disk = d;
            Adopt();
        }

        /// <summary>The stored save, trusting none of it (save.ts readDisk), or null when there is none.</summary>
        static Profile Read()
        {
            var raw = Store.Get(KEY);
            if (string.IsNullOrEmpty(raw)) return null;
            var d = Json.TryParseObject(raw) ?? new Dictionary<string, object>();
            var p = new Profile { disk = d };
            p.owned = new List<string>(FREE);
            foreach (var id in Json.List(d, "owned") ?? new List<object>())
                if (id is string s && !p.owned.Contains(s)) p.owned.Add(s);
            // You can only wear what you own.
            string Worn(string key, string otherwise) => Json.Str(d, key) is string id && p.owned.Contains(id) ? id : otherwise;
            p.skin = Worn("skin", "telfer");
            p.hat = Worn("hat", "no-hat");
            p.trail = Worn("trail", "no-trail");
            p.stars = Count(d, "stars");
            p.gems = Count(d, "gems");
            p.runs = Count(d, "runs");
            p.bestScore = Count(d, "bestScore");
            p.bestLength = Count(d, "bestLength");
            p.name = Names.Clean(Json.Str(d, "name")) ?? Names.Random();
            p.mega = Flag(d, "mega");
            p.commonUnlocked = Flag(d, "commonUnlocked");
            p.godRevealed = Flag(d, "godRevealed");
            p.commonSeen = Flag(d, "commonSeen");
            // The web game spells these in lower case; Mode and Stage below gate God and the Common.
            p.mode = Json.Str(d, "mode") switch { "easy" => "Easy", "god" => "God", null => "Easy", _ => "Normal" };
            // London (classic only, until HD's phase B) is kept as it is, so playing HD never resets a
            // child's chosen place; the Stage getter below still plays the school for it.
            p.stage = Json.Str(d, "stage") switch { "common" => "Common", "london" => "London", _ => "School" };
            return p;
        }

        static int Count(Dictionary<string, object> d, string key)
        {
            double v = Json.Num(d, key);
            return v > 0 ? (int)System.Math.Min(MAX_COUNT, System.Math.Floor(v)) : 0;
        }

        static bool Flag(Dictionary<string, object> d, string key) => d.TryGetValue(key, out var v) && v is bool b && b;

        /// <summary>This remaster's save from before it shared the web game's (Unity JSON), or null.</summary>
        static Profile FromOld(string json)
        {
            if (string.IsNullOrEmpty(json)) return null;
            Old o;
            try { o = JsonUtility.FromJson<Old>(json); } catch { return null; }
            if (o == null) return null;
            var p = new Profile
            {
                stars = o.stars, gems = o.gems, bestScore = o.bestScore, bestLength = o.bestLength, runs = o.runs,
                mode = o.mode ?? "Easy", stage = o.stage ?? "School", commonUnlocked = o.commonUnlocked, mega = o.mega,
                godRevealed = o.godRevealed, commonSeen = o.commonSeen, name = o.name ?? "",
            };
            foreach (var id in o.owned ?? new List<string>()) if (!p.owned.Contains(id)) p.owned.Add(id);
            if (p.owned.Contains(o.skin)) p.skin = o.skin;
            if (p.owned.Contains(o.hat)) p.hat = o.hat;
            if (p.owned.Contains(o.trail)) p.trail = o.trail;
            return p;
        }

        [System.Serializable]
        sealed class Old
        {
            public int stars, gems, bestScore, runs;
            public float bestLength;
            public List<string> owned;
            public string skin, hat, trail, mode, stage, name;
            public bool commonUnlocked, mega, godRevealed, commonSeen;
        }

        /// <summary>The browser's localStorage in a WebGL build (shared with the web game); PlayerPrefs elsewhere.</summary>
        static class Store
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            [DllImport("__Internal")] static extern string TelferSave_Read(string key);
            [DllImport("__Internal")] static extern int TelferSave_Write(string key, string value);
            public static string Get(string key) => TelferSave_Read(key);
            public static bool Set(string key, string value) => TelferSave_Write(key, value) == 1;
#else
            public static string Get(string key) => PlayerPrefs.GetString(key, "");
            public static bool Set(string key, string value)
            {
                PlayerPrefs.SetString(key, value);
                PlayerPrefs.Save();
                return true;
            }
#endif
        }

        public bool Owns(string id) => owned.Contains(id);

        /// <summary>God mode opens once you own the Golden Snake and the Wizard Hat and have gone MEGA on Normal.</summary>
        public bool GodUnlocked => mega && Owns("gold") && Owns("wizard");

        public Mode Mode
        {
            get => mode == "Easy" ? Mode.Easy : mode == "God" && GodUnlocked ? Mode.God : Mode.Normal;
            set => mode = value.ToString();
        }

        public StageId Stage
        {
            // "London" has no HD stage yet: it plays the school, but the saved choice stays "london".
            get => stage == "Common" && commonUnlocked ? StageId.Common : StageId.School;
            set => stage = value.ToString();
        }

        /// <summary>The look of the chosen skin, for the sim and the snake view.</summary>
        public SnakeLook Look()
        {
            var s = Catalogue.FindSkin(skin);
            return new SnakeLook("You", s.pattern[0], s.pattern[s.pattern.Length - 1], s.head);
        }
    }
}
