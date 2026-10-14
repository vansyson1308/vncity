// Hand-written shared types used by the generated content classes (Generated/HanoiContentTypes.cs).
// Twin of ue5/.../HanoiCoreTypes.h; tools/codegen_unity.py maps common.schema.json onto these.
// Pure C# (no UnityEngine): compiled by Unity and by unity/dotnet for the tests.

using System;
using System.Collections.Generic;
using System.Globalization;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace HanoiCity.Content
{
    /// <summary>Every collection row has a stable id.</summary>
    public interface IHanoiRow
    {
        string Id { get; }
    }

    /// <summary>Localised text from content JSON ({"vi", "en"}). Vietnamese is the source language.</summary>
    [Serializable]
    public sealed class HanoiText
    {
        [JsonProperty("vi", Required = Required.Always)] public string Vi { get; set; }
        [JsonProperty("en")] public string En { get; set; }

        /// <summary>English if requested and present, else Vietnamese.</summary>
        public string Get(bool english) => english && !string.IsNullOrEmpty(En) ? En : Vi;

        public override string ToString() => Vi;
    }

    /// <summary>WGS84 point. Convert with HanoiCity.Geo.HanoiGeoFrame. Null in content = absent.</summary>
    [Serializable]
    public sealed class HanoiGeo
    {
        [JsonProperty("lat", Required = Required.Always)] public double Lat { get; set; }
        [JsonProperty("lon", Required = Required.Always)] public double Lon { get; set; }
        /// <summary>Height above the city origin height, metres.</summary>
        [JsonProperty("alt_m")] public double AltM { get; set; }

        public HanoiGeo() { }
        public HanoiGeo(double lat, double lon, double altM = 0.0) { Lat = lat; Lon = lon; AltM = altM; }
    }

    /// <summary>Reference '&lt;collection&gt;:&lt;id&gt;' to another content row.</summary>
    [Serializable]
    [JsonConverter(typeof(HanoiRefConverter))]
    public sealed class HanoiRef : IEquatable<HanoiRef>
    {
        public string Collection { get; }
        public string Id { get; }

        public HanoiRef(string collection, string id)
        {
            Collection = collection ?? "";
            Id = id ?? "";
        }

        public bool IsValid => Collection.Length > 0 && Id.Length > 0;

        /// <summary>Parses "collection:id"; null on malformed input.</summary>
        public static HanoiRef Parse(string text)
        {
            if (string.IsNullOrEmpty(text)) return null;
            int i = text.IndexOf(':');
            if (i <= 0 || i == text.Length - 1) return null;
            return new HanoiRef(text.Substring(0, i), text.Substring(i + 1));
        }

        /// <summary>The id of "collection:id", or the text itself when it has no collection prefix.</summary>
        public static string IdOf(string text)
        {
            var r = Parse(text);
            return r != null ? r.Id : text;
        }

        public override string ToString() => Collection + ":" + Id;
        public bool Equals(HanoiRef other) => other != null && Collection == other.Collection && Id == other.Id;
        public override bool Equals(object obj) => Equals(obj as HanoiRef);
        public override int GetHashCode() => (Collection.GetHashCode() * 397) ^ Id.GetHashCode();
    }

    /// <summary>Hours of day [From, To), 0-24; To &lt; From wraps past midnight. Absent (null) = always.</summary>
    [Serializable]
    [JsonConverter(typeof(HanoiHourRangeConverter))]
    public sealed class HanoiHourRange
    {
        public double From { get; set; }
        public double To { get; set; } = 24.0;

        public HanoiHourRange() { }
        public HanoiHourRange(double from, double to) { From = from; To = to; }

        public bool Contains(double hour)
        {
            if (From <= To) return hour >= From && (hour < To || To >= 24.0);
            return hour >= From || hour < To;
        }
    }

    public enum HanoiTargetKind { Unset = 0, Geo, Ref }

    /// <summary>Schema oneOf [geo, ref] (mission step target): a WGS84 point or a reference to a row.</summary>
    [Serializable]
    [JsonConverter(typeof(HanoiTargetConverter))]
    public sealed class HanoiTarget
    {
        public HanoiTargetKind Kind { get; set; }
        public HanoiGeo Geo { get; set; }
        public HanoiRef Ref { get; set; }
    }

    /// <summary>
    /// Schema oneOf [id, {outcome: id}] (mission step next): one next step, or a branch table keyed by
    /// outcome (choice key, minigame result, flag name). Null = the next step in array order.
    /// </summary>
    [Serializable]
    [JsonConverter(typeof(HanoiNextConverter))]
    public sealed class HanoiNext
    {
        public string Step { get; set; }
        public Dictionary<string, string> Branches { get; } = new Dictionary<string, string>();

        public bool IsBranching => Branches.Count > 0;
    }

    // ------------------------------------------------------------------ converters

    public sealed class HanoiRefConverter : JsonConverter<HanoiRef>
    {
        public override HanoiRef ReadJson(JsonReader reader, Type objectType, HanoiRef existing, bool hasExisting, JsonSerializer serializer)
        {
            if (reader.TokenType == JsonToken.Null) return null;
            if (reader.TokenType != JsonToken.String)
                throw new JsonSerializationException($"ref must be a string 'collection:id' at {reader.Path}");
            var text = (string)reader.Value;
            return HanoiRef.Parse(text) ?? throw new JsonSerializationException($"malformed ref '{text}' at {reader.Path}");
        }

        public override void WriteJson(JsonWriter writer, HanoiRef value, JsonSerializer serializer)
        {
            if (value == null) writer.WriteNull(); else writer.WriteValue(value.ToString());
        }
    }

    public sealed class HanoiHourRangeConverter : JsonConverter<HanoiHourRange>
    {
        public override HanoiHourRange ReadJson(JsonReader reader, Type objectType, HanoiHourRange existing, bool hasExisting, JsonSerializer serializer)
        {
            if (reader.TokenType == JsonToken.Null) return null;
            var arr = JArray.Load(reader);
            if (arr.Count != 2)
                throw new JsonSerializationException($"hour_range must be [from, to] at {reader.Path}");
            return new HanoiHourRange((double)arr[0], (double)arr[1]);
        }

        public override void WriteJson(JsonWriter writer, HanoiHourRange value, JsonSerializer serializer)
        {
            if (value == null) { writer.WriteNull(); return; }
            writer.WriteStartArray();
            writer.WriteValue(value.From);
            writer.WriteValue(value.To);
            writer.WriteEndArray();
        }
    }

    public sealed class HanoiTargetConverter : JsonConverter<HanoiTarget>
    {
        public override HanoiTarget ReadJson(JsonReader reader, Type objectType, HanoiTarget existing, bool hasExisting, JsonSerializer serializer)
        {
            switch (reader.TokenType)
            {
                case JsonToken.Null:
                    return null;
                case JsonToken.String:
                    var text = (string)reader.Value;
                    var r = HanoiRef.Parse(text) ?? throw new JsonSerializationException($"malformed target ref '{text}' at {reader.Path}");
                    return new HanoiTarget { Kind = HanoiTargetKind.Ref, Ref = r };
                case JsonToken.StartObject:
                    return new HanoiTarget { Kind = HanoiTargetKind.Geo, Geo = serializer.Deserialize<HanoiGeo>(reader) };
                default:
                    throw new JsonSerializationException($"target must be a geo object or a ref at {reader.Path}");
            }
        }

        public override void WriteJson(JsonWriter writer, HanoiTarget value, JsonSerializer serializer)
        {
            if (value == null || value.Kind == HanoiTargetKind.Unset) writer.WriteNull();
            else if (value.Kind == HanoiTargetKind.Ref) serializer.Serialize(writer, value.Ref);
            else serializer.Serialize(writer, value.Geo);
        }
    }

    public sealed class HanoiNextConverter : JsonConverter<HanoiNext>
    {
        public override HanoiNext ReadJson(JsonReader reader, Type objectType, HanoiNext existing, bool hasExisting, JsonSerializer serializer)
        {
            switch (reader.TokenType)
            {
                case JsonToken.Null:
                    return null;
                case JsonToken.String:
                    return new HanoiNext { Step = (string)reader.Value };
                case JsonToken.StartObject:
                    var next = new HanoiNext();
                    foreach (var p in JObject.Load(reader).Properties())
                    {
                        if (p.Value.Type != JTokenType.String)
                            throw new JsonSerializationException($"next branch '{p.Name}' must name a step at {reader.Path}");
                        next.Branches[p.Name] = (string)p.Value;
                    }
                    return next;
                default:
                    throw new JsonSerializationException($"next must be a step id or a branch table at {reader.Path}");
            }
        }

        public override void WriteJson(JsonWriter writer, HanoiNext value, JsonSerializer serializer)
        {
            if (value == null) { writer.WriteNull(); return; }
            if (!value.IsBranching) { writer.WriteValue(value.Step); return; }
            writer.WriteStartObject();
            foreach (var kv in value.Branches)
            {
                writer.WritePropertyName(kv.Key);
                writer.WriteValue(kv.Value);
            }
            writer.WriteEndObject();
        }
    }

    internal static class HanoiFormat
    {
        public static string Num(double v) => v.ToString("0.###", CultureInfo.InvariantCulture);
    }
}
