using System.Reflection;
using Telfer.Meta;
using UnityEngine;

namespace Telfer.EditorTools
{
    /// <summary>
    /// Editor check for the shared save (Tools/ev.sh 'return Telfer.EditorTools.ProfileTest.FailingWrites();'):
    /// a save whose writes fail must not apply its stars twice once a later save gets through, and the web game's own stars banked meanwhile are kept. The dev
    /// PlayerPrefs are put back as they were afterwards.
    /// </summary>
    public static class ProfileTest
    {
        const string KEY = "telfersnake.save.v1", LONDON = "telfersnake.london.v1";

        public static string FailingWrites()
        {
            string keep = PlayerPrefs.GetString(KEY, null), keepLondon = PlayerPrefs.GetString(LONDON, null);
            bool hadLondon = PlayerPrefs.HasKey(LONDON);
            try
            {
                PlayerPrefs.SetString(KEY, "{\"stars\":100,\"gems\":3,\"name\":\"TestySnake1\"}");
                PlayerPrefs.DeleteKey(LONDON);
                var load = typeof(Profile).GetMethod("Load", BindingFlags.NonPublic | BindingFlags.Static);
                var p = (Profile)load.Invoke(null, null);
                p.stars += 50;
                p.postcards.Add("bigben");
                // Twice a failing write (the London key, then the main key), then one that gets through.
                Profile.FailWrite = k => true;
                p.Save();
                Profile.FailWrite = k => k == KEY;
                p.Save();
                // Meanwhile the web game (another tab) banks 20 stars of its own.
                PlayerPrefs.SetString(KEY, PlayerPrefs.GetString(KEY).Replace("\"stars\":100", "\"stars\":120"));
                Profile.FailWrite = null;
                p.Save();
                var stored = PlayerPrefs.GetString(KEY);
                bool ok = stored.Contains("\"stars\":170") && p.stars == 170 && PlayerPrefs.GetString(LONDON).Contains("bigben");
                // And a later save with nothing new changes nothing.
                p.Save();
                ok &= PlayerPrefs.GetString(KEY).Contains("\"stars\":170");
                return (ok ? "PASS" : "FAIL") + " stars=" + p.stars + " stored=" + stored;
            }
            finally
            {
                Profile.FailWrite = null;
                if (keep != null) PlayerPrefs.SetString(KEY, keep); else PlayerPrefs.DeleteKey(KEY);
                if (hadLondon) PlayerPrefs.SetString(LONDON, keepLondon); else PlayerPrefs.DeleteKey(LONDON);
                PlayerPrefs.Save();
            }
        }
    }
}
