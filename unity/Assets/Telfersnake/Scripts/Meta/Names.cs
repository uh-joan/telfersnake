using System.Linq;
using System.Text;

namespace Telfer.Meta
{
    /// <summary>
    /// Snake names (names.ts). A child may type their own, or shuffle for a random one. Other children
    /// see the name over your head, so everything typed is cleaned first, here and again on the server.
    /// </summary>
    public static class Names
    {
        static readonly string[] FIRST =
        {
            "Zippy", "Bouncy", "Sparkly", "Wobbly", "Snazzy", "Jolly", "Fizzy", "Sunny", "Minty", "Rosy", "Golden", "Purple",
            "Stripy", "Spotty", "Speedy", "Sneaky", "Giggly", "Mighty", "Tiny", "Super", "Turbo", "Cosmic", "Rainbow", "Funky",
            "Sleepy", "Hungry", "Lucky", "Cheeky", "Brave", "Dizzy",
        };

        static readonly string[] SECOND =
        {
            "Noodle", "Python", "Adder", "Cobra", "Wiggler", "Slinky", "Boa", "Viper", "Mamba", "Squiggle", "Hisser", "Coil",
            "Sausage", "Spaghetti", "Pretzel", "Worm", "Dragon", "Ribbon", "Zigzag", "Shoelace", "Rattler", "Sidewinder",
        };

        public const int MAX = 16;

        /// <summary>Rude words and slurs, matched against the name with spaces and digits stripped out. Small on purpose.</summary>
        static readonly string[] BLOCK =
        {
            "fuck", "shit", "cunt", "bitch", "bastard", "dick", "cock", "penis", "vagina", "boob", "tit", "arse", "ass",
            "wank", "piss", "crap", "sex", "nazi", "hitler", "nigger", "nigga", "faggot", "fag", "rape", "slut", "whore", "porn",
        };

        static readonly System.Random rng = new System.Random();

        public static string Random()
        {
            // Kept within MAX so it is never cut off mid-word.
            for (int tries = 0; tries < 40; tries++)
            {
                var name = FIRST[rng.Next(FIRST.Length)] + SECOND[rng.Next(SECOND.Length)] + (10 + rng.Next(90));
                if (name.Length <= MAX) return name;
            }
            return "Snake" + (10 + rng.Next(90));
        }

        /// <summary>Letters, numbers and single spaces, plain ASCII, capped; null if empty or rude.</summary>
        public static string Clean(string raw)
        {
            if (raw == null) return null;
            var sb = new StringBuilder();
            foreach (char c in raw.Normalize(NormalizationForm.FormKD))
            {
                if (c > 0x7e) continue;
                if (char.IsLetterOrDigit(c)) sb.Append(c);
                else if (char.IsWhiteSpace(c) && sb.Length > 0 && sb[sb.Length - 1] != ' ') sb.Append(' ');
            }
            var name = sb.ToString().Trim();
            if (name.Length > MAX) name = name.Substring(0, MAX).Trim();
            if (name.Length < 1) return null;
            var bare = new string(name.ToLowerInvariant().Where(c => c >= 'a' && c <= 'z').ToArray());
            if (BLOCK.Any(w => bare.Contains(w))) return null;
            return name;
        }
    }
}
