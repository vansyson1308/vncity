using System.IO;
using System.Linq;
using HanoiCity.Content;
using HanoiCity.Systems;
using Newtonsoft.Json.Linq;
using NUnit.Framework;

namespace HanoiCity.Tests
{
    public class ContentTests
    {
        [Test]
        public void EveryContentFileLoadsStrictlyIntoTheGeneratedClasses()
        {
            var db = TestPaths.RealContent;  // throws on any unknown key, bad enum, missing required key, duplicate id
            int expected = 0;
            foreach (var path in Directory.GetFiles(TestPaths.Content, "*.json", SearchOption.AllDirectories))
            {
                var doc = JToken.Parse(File.ReadAllText(path)) as JObject;
                if (doc?["collection"] == null) continue;
                expected += ((JArray)doc["items"]).Count;
            }
            Assert.That(db.TotalRows, Is.EqualTo(expected));
            Assert.That(db.Count("missions"), Is.GreaterThan(0));
            Assert.That(db.Collections, Is.SubsetOf(HanoiCollections.RowTypes.Keys));
        }

        [Test]
        public void UnknownKeysAndBadEnumsAreRejected()
        {
            var db = new HanoiContentDatabase();
            Assert.Throws<InvalidDataException>(() => db.LoadDocument(
                "{\"collection\": \"factions\", \"items\": [{\"id\": \"x\", \"name\": {\"vi\": \"X\"}, \"typo\": 1}]}", "bad"));
            Assert.Throws<InvalidDataException>(() => db.LoadDocument(
                "{\"collection\": \"vehicles\", \"items\": [{\"id\": \"v\", \"name\": {\"vi\": \"V\"}, \"class\": \"spaceship\"}]}", "bad"));
        }

        [Test]
        public void OneOfTypesParse()
        {
            var db = TestPaths.RealContent;
            var steps = db.All<HanoiMissionRow>("missions").SelectMany(m => m.Steps).ToList();
            Assert.That(steps.Any(s => s.Target?.Kind == HanoiTargetKind.Geo), "some step targets a coordinate");
            Assert.That(steps.Any(s => s.Target?.Kind == HanoiTargetKind.Ref), "some step targets a ref");
            Assert.That(steps.Any(s => s.Next != null && s.Next.IsBranching), "some step branches");
            Assert.That(steps.Any(s => s.Next != null && !s.Next.IsBranching), "some step names its next");
            Assert.That(steps.Where(s => s.Params != null).All(s => s.Params.Type == JTokenType.Object));
        }

        [Test]
        public void RuntimeParamsMatchTheSchema()
        {
            var schema = JObject.Parse(File.ReadAllText(Path.Combine(TestPaths.Schemas, "missions.schema.json")));
            var props = (JObject)schema["properties"]["items"]["items"]["properties"]["steps"]["items"]["properties"]["params"]["properties"];
            var runtime = props.Properties().Where(p => (string)p.Value["x-consumer"] == "runtime").Select(p => p.Name).OrderBy(n => n).ToList();
            Assert.That(MissionRunner.RuntimeParams.OrderBy(n => n).ToList(), Is.EqualTo(runtime));
        }

        [Test]
        public void EveryRefInContentResolvesOrIsAKnownCollection()
        {
            var db = TestPaths.RealContent;
            foreach (var m in db.All<HanoiMissionRow>("missions"))
            {
                // An activity target has no place of its own: the step runs wherever the player does it.
                foreach (var s in m.Steps.Where(s => s.Target?.Kind == HanoiTargetKind.Ref && s.Target.Ref.Collection != "activities"))
                    Assert.That(db.ResolveLocation(s.Target.Ref), Is.Not.Null, $"{m.Id}/{s.Id} target {s.Target.Ref} has no location");
                foreach (var s in m.Steps.Where(s => s.Dialogue != null))
                    Assert.That(db.Dialogue(s.Dialogue.Id), Is.Not.Null, $"{m.Id}/{s.Id} dialogue {s.Dialogue}");
            }
        }
    }
}
