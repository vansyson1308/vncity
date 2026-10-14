using System;
using System.IO;
using HanoiCity.Content;
using HanoiCity.Geo;

namespace HanoiCity.Tests
{
    /// <summary>Finds the repo (the folder holding game/content) from Unity's project dir or dotnet's bin dir.</summary>
    public static class TestPaths
    {
        static string root;

        public static string Root
        {
            get
            {
                if (root != null) return root;
                foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
                {
                    var dir = new DirectoryInfo(start);
                    while (dir != null)
                    {
                        if (Directory.Exists(Path.Combine(dir.FullName, "game", "content")) && Directory.Exists(Path.Combine(dir.FullName, "game", "schemas")))
                            return root = dir.FullName;
                        dir = dir.Parent;
                    }
                }
                throw new DirectoryNotFoundException("repo root with game/content not found above " + Directory.GetCurrentDirectory());
            }
        }

        public static string Content => Path.Combine(Root, "game", "content");
        public static string Schemas => Path.Combine(Root, "game", "schemas");

        static HanoiContentDatabase content;

        /// <summary>The real game content, loaded once (strict).</summary>
        public static HanoiContentDatabase RealContent => content ??= HanoiContentDatabase.LoadDirectory(Content);
    }

    /// <summary>A pawn the tests can teleport.</summary>
    public sealed class FakePlayer : IHanoiPlayerQuery
    {
        public bool HasPawn { get; set; } = true;
        public Double3 PositionEnu { get; set; }
        public bool OnVehicle { get; set; } = true;
        public bool InCar { get; set; }
        public bool OnBicycle { get; set; }
        public string RoadType { get; set; } = "pho";
    }

    public static class Worlds
    {
        public static readonly DateTime Monday0700 = new DateTime(2026, 10, 12, 7, 0, 0);

        /// <summary>A world on the real content at a fixed time and seed, with a fake player at the origin.</summary>
        public static HanoiWorld Real(DateTime? start = null, ulong seed = 1)
        {
            var w = new HanoiWorld(TestPaths.RealContent, new HanoiRules(), start ?? Monday0700, seed);
            w.Player = new FakePlayer();
            return w;
        }

        /// <summary>A world on a small content set given as collection documents.</summary>
        public static HanoiWorld FromDocuments(DateTime? start, params string[] documents)
        {
            var db = new HanoiContentDatabase();
            int i = 0;
            foreach (var d in documents) db.LoadDocument(d.Replace('\'', '"'), "doc" + i++);
            var w = new HanoiWorld(db, new HanoiRules(), start ?? Monday0700, 7);
            w.Player = new FakePlayer();
            return w;
        }
    }
}
