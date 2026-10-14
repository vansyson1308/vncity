using System;
using HanoiCity.Weather;
using UnityEngine;
using UnityEngine.Networking;

namespace HanoiCity.UnityLayer
{
    /// <summary>
    /// Weather from the live/weather.py HTTP feed (same JSON as UE's WeatherEndpoint). Falls back to
    /// climatology when the feed is down or returns something it cannot parse, so the game never
    /// waits on the network.
    /// </summary>
    public sealed class HanoiWebWeatherProvider : IHanoiWeatherProvider
    {
        readonly string endpoint;
        readonly int timeoutSeconds;

        public HanoiWebWeatherProvider(string endpoint, int timeoutSeconds = 5)
        {
            this.endpoint = endpoint;
            this.timeoutSeconds = timeoutSeconds;
        }

        public void RequestWeather(DateTime hanoiLocal, Action<HanoiWeatherState> done)
        {
            var req = UnityWebRequest.Get(endpoint);
            req.timeout = timeoutSeconds;
            req.SendWebRequest().completed += _ =>
            {
                HanoiWeatherState state = null;
                if (req.result == UnityWebRequest.Result.Success && HanoiWeatherFeed.TryParse(req.downloadHandler.text, out var parsed))
                    state = parsed;
                else
                    Debug.LogWarning($"[HanoiCity] weather feed {endpoint}: {req.error ?? "unparsable"}; using climatology");
                req.Dispose();
                done(state ?? HanoiClimatologyWeather.Sample(hanoiLocal));
            };
        }
    }
}
