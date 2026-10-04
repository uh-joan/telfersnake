using System.Collections.Generic;
using Telfer.Sim;
using UnityEngine;

namespace Telfer.Meta
{
    /// <summary>
    /// What the player keeps between runs (save.ts): stars and blue gems, what they have bought and are
    /// wearing, where and how they last played, and the unlocks. Kept as JSON in PlayerPrefs, which on
    /// WebGL lives in the browser's IndexedDB.
    /// </summary>
    [System.Serializable]
    public sealed class Profile
    {
        public int stars;
        public int gems;
        public List<string> owned = new List<string> { "telfer", "no-hat", "no-trail" };
        public string skin = "telfer", hat = "no-hat", trail = "no-trail";
        public int bestScore;
        public float bestLength;
        public int runs;
        public string mode = "Normal";
        public string stage = "School";
        public bool commonUnlocked;
        /// <summary>Reached MEGA in a Normal game: half of God mode's key.</summary>
        public bool mega;
        public bool godRevealed, commonSeen;

        /// <summary>The one-off star ticket to the Common.</summary>
        public const int COMMON_COST = 300;
        const string KEY = "telfersnake-profile";

        static Profile current;
        public static Profile I => current ?? (current = Load());

        static Profile Load()
        {
            var json = PlayerPrefs.GetString(KEY, "");
            Profile p = null;
            if (json.Length > 0) { try { p = JsonUtility.FromJson<Profile>(json); } catch { p = null; } }
            if (p == null)
            {
                p = new Profile();
                // Carry over the best score and stars from the first cut of the remaster.
                p.bestScore = PlayerPrefs.GetInt("best", 0);
                p.stars = PlayerPrefs.GetInt("stars", 0);
            }
            if (p.owned == null) p.owned = new List<string>();
            foreach (var free in new[] { "telfer", "no-hat", "no-trail" }) if (!p.owned.Contains(free)) p.owned.Add(free);
            return p;
        }

        public void Save()
        {
            PlayerPrefs.SetString(KEY, JsonUtility.ToJson(this));
            PlayerPrefs.Save();
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
