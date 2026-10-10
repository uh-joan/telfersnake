using UnityEngine;

namespace Telfer.Meta
{
    public enum ItemKind { Skin, Hat, Trail }

    /// <summary>One thing the Tuck Shop sells. Price is in stars, or in blue gems when <see cref="gem"/> is set.</summary>
    public sealed class Item
    {
        public string id, name;
        public ItemKind kind;
        public int price;
        /// <summary>Common-only: bought with blue gems, and only shown once the Common is unlocked.</summary>
        public bool gem;
        /// <summary>Skins: head colour.</summary>
        public uint head;
        /// <summary>Skins: segment colours from the neck back, repeating.</summary>
        public uint[] pattern;
        /// <summary>Trails: particle colours.</summary>
        public uint[] palette;
        /// <summary>Where it is sold: null everywhere, "common" or "london" only once that place is unlocked.</summary>
        public string place;
        /// <summary>Skins: the pattern chases along the body like a string of lights (Piccadilly Lights).</summary>
        public bool shimmer;
    }

    /// <summary>
    /// Everything the Tuck Shop sells, a straight port of src/meta/catalogue.ts. Paid for with stars
    /// earned by playing, and nothing else: there is no real money anywhere in this game.
    /// </summary>
    public static class Catalogue
    {
        static Item Skin(string id, string name, int price, uint head, params uint[] pattern) =>
            new Item { id = id, name = name, kind = ItemKind.Skin, price = price, head = head, pattern = pattern };

        static Item GemSkin(string id, string name, int price, uint head, params uint[] pattern)
        {
            var s = Skin(id, name, price, head, pattern);
            s.gem = true;
            s.place = "common";
            return s;
        }

        static Item Hat(string id, string name, int price, bool gem = false) =>
            new Item { id = id, name = name, kind = ItemKind.Hat, price = price, gem = gem, place = gem ? "common" : null };

        static Item Trail(string id, string name, int price, bool gem, params uint[] palette) =>
            new Item { id = id, name = name, kind = ItemKind.Trail, price = price, gem = gem, palette = palette, place = gem ? "common" : null };

        /// <summary>London's own (A7, docs/london-catalogue.md): same ids, prices and currencies as the web game.</summary>
        static Item London(Item it) { it.place = "london"; return it; }

        static Item Shimmer(Item it) { it.shimmer = true; return it; }

        public static readonly Item[] Skins =
        {
            Skin("telfer", "Classic Telfer", 0, 0x57c955, 0x4cbb4a, 0x4cbb4a, 0x4cbb4a, 0x4cbb4a, 0xf2d94a),
            Skin("jumper", "School Jumper", 40, 0x1b3a86, 0x1b3a86, 0x1b3a86, 0x1b3a86, 0xffd21f),
            Skin("pe", "PE Kit", 40, 0xffffff, 0xffffff, 0xffffff, 0x1b3a86),
            Skin("bumble", "Bumblebee", 60, 0xffd43b, 0xffd43b, 0xffd43b, 0x1c1c1f, 0x1c1c1f),
            Skin("tiger", "Tiger", 80, 0xff922b, 0xff922b, 0xff922b, 0xff922b, 0x1c1c1f),
            Skin("candy", "Candy Cane", 80, 0xffffff, 0xe03131, 0xe03131, 0xffffff, 0xffffff),
            Skin("dino", "Dinosaur", 120, 0x2f9e44, 0x2f9e44, 0x2f9e44, 0x9c36b5),
            Skin("sausage", "Sausage Dog", 150, 0x8a5a3a, 0xa86b42),
            Skin("robot", "Robot", 180, 0xced4da, 0xadb5bd, 0xadb5bd, 0x22b8cf),
            Skin("rainbow", "Rainbow", 200, 0xff6b6b, 0xff6b6b, 0xffa94d, 0xffd43b, 0x69db7c, 0x4dabf7, 0x9775fa),
            Skin("bus", "Bendy Bus", 250, 0xd62828, 0xd62828, 0xa5d8ff, 0xd62828, 0xd62828),
            Skin("tube", "Tube Train", 250, 0xe03131, 0xf1f3f5, 0xf1f3f5, 0x1c4fa3, 0xf1f3f5, 0xe03131),
            Skin("caterpillar", "Caterpillar", 50, 0xe03131, 0x8ce99a, 0x51cf66),
            Skin("zebra", "Zebra", 70, 0xffffff, 0xffffff, 0xffffff, 0x1c1c1f),
            Skin("ladybird", "Ladybird", 70, 0x1c1c1f, 0xe03131, 0xe03131, 0x1c1c1f, 0xe03131),
            Skin("watermelon", "Watermelon", 90, 0x2f9e44, 0xff6b81, 0xff6b81, 0x1c1c1f, 0xff6b81, 0x2f9e44),
            Skin("football", "Football Kit", 90, 0xffffff, 0x1971c2, 0x1971c2, 0xffffff),
            Skin("ice", "Ice Pop", 110, 0xe7f5ff, 0xa5d8ff, 0xd0ebff, 0xffffff),
            Skin("lava", "Lava", 130, 0x2b2d42, 0x2b2d42, 0xff4500, 0xffb703, 0xff4500),
            Skin("camo", "Camouflage", 130, 0x5c7c3a, 0x5c7c3a, 0x3d5a2a, 0x8a9a5b, 0x4a3f2a),
            Skin("allsorts", "Allsorts", 160, 0x1c1c1f, 0xff8fab, 0x1c1c1f, 0xffd43b, 0x1c1c1f, 0xffffff, 0x1c1c1f, 0x4dabf7, 0x1c1c1f),
            Skin("unicorn", "Unicorn", 220, 0xffffff, 0xffc9de, 0xe5dbff, 0xc5f6fa, 0xfff3bf),
            Skin("galaxy", "Galaxy", 280, 0x3b1d6e, 0x1b1340, 0x3b1d6e, 0x5f3dc4, 0x22b8cf, 0x3b1d6e),
            Skin("nessie", "Loch Ness", 300, 0x0b7285, 0x0b7285, 0x0b7285, 0x15aabf),
            Skin("gold", "Golden Snake", 500, 0xffe066, 0xffd43b, 0xfab005, 0xffe066),
            // Common-only, bought with blue gems: forest and magic looks.
            GemSkin("fox", "Sly Fox", 30, 0xd9662a, 0xd9662a, 0xd9662a, 0xf3ead3),
            GemSkin("toadstool", "Toadstool", 25, 0xd23b32, 0xd23b32, 0xffffff, 0xd23b32, 0xd23b32),
            GemSkin("stag", "White Stag", 45, 0xf3efe6, 0xe9e4d8, 0xe6c766, 0xe9e4d8),
            // London-only (A7): everyday ones in stars, the special ones in blue gems.
            London(Skin("black-cab", "Black Cab", 150, 0x1d1f24, 0x1d1f24, 0x1d1f24, 0x1d1f24, 0xffc93c)),
            London(Skin("union-jack", "Union Jack", 200, 0x1f3fa8, 0xc8102e, 0xffffff, 0x1f3fa8, 0xffffff)),
            London(Skin("royal-guard", "Royal Guard", 180, 0x1c1c1f, 0xd8342c, 0xd8342c, 0xf2c230, 0xd8342c, 0xd8342c, 0x1c1c1f)),
            London(Skin("postbox", "Postbox Red", 90, 0xd62d20, 0xd62d20, 0xd62d20, 0xd62d20, 0x1c1c1f)),
            London(Skin("corgi", "Corgi", 120, 0xe39b4c, 0xe39b4c, 0xe39b4c, 0xfff6e8, 0xe39b4c)),
            London(Skin("tower-blue", "Tower Bridge Blue", 110, 0xd9cdb3, 0x8cc8ec, 0x8cc8ec, 0xffffff, 0x8cc8ec)),
            London(Skin("thames", "The Thames", 140, 0x1f8a96, 0x1f8a96, 0x2fa6b0, 0x6fd0cf, 0x2fa6b0, 0xffffff)),
            London(Skin("trafalgar-bronze", "Trafalgar Bronze", 160, 0x9a7444, 0x9a7444, 0xb88a52, 0xd1aa70, 0xb88a52)),
            London(GemSkin("pearly-king", "Pearly King", 45, 0x1c1c1f, 0x1c1c1f, 0xfffaf0, 0x1c1c1f, 0x1c1c1f, 0xfffaf0)),
            Shimmer(London(GemSkin("piccadilly-lights", "Piccadilly Lights", 60, 0x2b1d4e, 0xff3fa4, 0xffd23f, 0x3fb6ff, 0x5cff8a, 0xff7a2f, 0xb36bff))),
        };

        public static readonly Item[] Hats =
        {
            Hat("no-hat", "No hat", 0),
            Hat("party", "Party Hat", 40),
            Hat("bobble", "Bobble Hat", 60),
            Hat("propeller", "Propeller Cap", 80),
            Hat("wizard", "Wizard Hat", 2000), // the legendary one: dearer than anything else
            Hat("flower", "Flower", 50),
            Hat("cat-ears", "Cat Ears", 60),
            Hat("bunny-ears", "Bunny Ears", 70),
            Hat("chef", "Chef Hat", 80),
            Hat("cone", "Traffic Cone", 80),
            Hat("cowboy", "Cowboy Hat", 110),
            Hat("top-hat", "Top Hat", 120),
            Hat("pirate", "Pirate Hat", 130),
            Hat("viking", "Viking Helmet", 140),
            Hat("halo", "Halo", 160),
            Hat("crown", "Crown", 150),
            // Common-only, bought with blue gems.
            Hat("acorn", "Acorn Cap", 20, true),
            Hat("flower-crown", "Flower Crown", 25, true),
            Hat("antlers", "Antlers", 30, true),
            // London-only (A7).
            London(Hat("bowler", "Bowler Hat", 90)),
            London(Hat("deerstalker", "Deerstalker", 110)),
            London(Hat("bobby", "Bobby Helmet", 120)),
            London(Hat("pearly-cap", "Pearly King Cap", 130)),
            London(Hat("beefeater", "Beefeater Hat", 140)),
            London(Hat("tiara", "Tiara", 150)),
            London(Hat("union-top-hat", "Union Jack Top Hat", 160)),
            London(Hat("tiny-bigben", "Tiny Big Ben", 220)),
            London(Hat("bearskin", "Bearskin", 50, true)),
        };

        public static readonly Item[] Trails =
        {
            Trail("no-trail", "No trail", 0, false),
            Trail("sparkle", "Sparkles", 60, false, 0xffd84a, 0xfff3b0, 0xffffff),
            Trail("bubbles", "Bubbles", 60, false, 0xa5d8ff, 0xe7f5ff, 0xffffff),
            Trail("leaves", "Autumn Leaves", 60, false, 0xe8590c, 0xf59f00, 0x8a5a3a),
            Trail("hearts", "Love Hearts", 70, false, 0xff8fab, 0xff4d6d, 0xffc2d1),
            Trail("snow", "Snowflakes", 70, false, 0xffffff, 0xe7f5ff, 0xd0ebff),
            Trail("slime", "Slime", 80, false, 0x94d82d, 0x66a80f, 0xc0eb75),
            Trail("embers", "Embers", 100, false, 0xff4500, 0xffb703, 0xffe066),
            Trail("ocean", "Sea Spray", 100, false, 0x15aabf, 0x66d9e8, 0xffffff),
            Trail("confetti", "Confetti", 120, false, 0xffd84a, 0xff6b6b, 0x4dabf7, 0x8be36a, 0xf783ac, 0xffffff),
            Trail("stardust", "Stardust", 140, false, 0xfff3bf, 0xffd43b, 0x748ffc, 0xffffff),
            Trail("rainbow-trail", "Rainbow Dust", 150, false, 0xff6b6b, 0xffa94d, 0xffd43b, 0x69db7c, 0x4dabf7, 0x9775fa),
            // Common-only, bought with blue gems.
            Trail("petals", "Petals", 25, true, 0xffc9de, 0xff8fab, 0xffffff),
            Trail("fireflies", "Fireflies", 30, true, 0xfff6a0, 0xc0eb75, 0xffffff),
            Trail("magic-dust", "Magic Dust", 40, true, 0x9775fa, 0xc0ffe6, 0xffd43b, 0xffffff),
            // London-only (A7).
            London(Trail("raindrops", "Raindrops", 70, false, 0x74c0fc, 0xa5d8ff, 0xe7f5ff)),
            London(Trail("pigeon-feathers", "Pigeon Feathers", 70, false, 0x9aa0aa, 0xc9ced6, 0xffffff, 0x7f8f9a)),
            London(Trail("tea-bubbles", "Tea Bubbles", 80, false, 0xc98a45, 0xf3e3c3, 0xffffff)),
            London(Trail("bunting", "Bunting", 90, false, 0xc8102e, 0xffffff, 0x1f3fa8)),
            London(Trail("thames-spray", "Thames Spray", 100, false, 0x1f8a96, 0x6fd0cf, 0xffffff)),
            London(Trail("red-arrows", "Red Arrows", 140, false, 0xe8303a, 0xffffff, 0x2f5fd0)),
            London(Trail("fireworks", "Fireworks", 40, true, 0xff3fa4, 0xffd23f, 0x3fb6ff, 0x5cff8a, 0xffffff)),
        };

        public static Item[] Of(ItemKind k)
        {
            switch (k)
            {
                case ItemKind.Skin: return Skins;
                case ItemKind.Hat: return Hats;
                default: return Trails;
            }
        }

        /// <summary>Any item by id, or null if there is no such item.</summary>
        /// <summary>The skin with this id, or the default skin if the id is unknown or names a hat or trail.</summary>
        public static Item FindSkin(string id)
        {
            var it = Find(id);
            return it != null && it.kind == ItemKind.Skin ? it : Find("telfer");
        }

        public static Item Find(string id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            foreach (var list in new[] { Skins, Hats, Trails })
                foreach (var it in list)
                    if (it.id == id) return it;
            return null;
        }

        /// <summary>Stars for a run: a steady trickle for points, plus treats for growing up and for bonking rivals.</summary>
        public static int StarsFor(float score, int highestTier, int rivalsBonked) =>
            Mathf.FloorToInt(score / 100f) + 10 * highestTier + 5 * rivalsBonked;
    }
}
