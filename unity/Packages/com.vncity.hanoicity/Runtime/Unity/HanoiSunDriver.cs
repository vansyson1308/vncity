using HanoiCity.Time;
using UnityEngine;

namespace HanoiCity.UnityLayer
{
    /// <summary>
    /// Points the directional light at the real Hanoi sun for the game clock (NOAA, the same as
    /// UE's UHanoiTimeWeatherSubsystem), dims it below the horizon and tints it by weather. A moon
    /// light, if set, takes over at night. HDRP's physically based sky reads the light direction.
    /// </summary>
    [RequireComponent(typeof(Light))]
    public sealed class HanoiSunDriver : MonoBehaviour
    {
        public Light moon;
        [Tooltip("Lux at noon in clear weather (HDRP physical units).")]
        public float clearNoonLux = 100000f;
        [Tooltip("Lux of the moon light at night.")]
        public float moonLux = 0.5f;
        public Gradient colourByElevation;

        Light sun;

        void Awake() => sun = GetComponent<Light>();

        void LateUpdate()
        {
            var game = HanoiGame.Instance;
            if (game == null || game.World == null) return;
            var w = game.World;
            HanoiSun.Position(w.Clock.Utc, w.Rules.OriginLat, w.Rules.OriginLon, out var el, out var az);
            HanoiSun.DirectionToSunUnity(el, az, out var x, out var y, out var z);
            var toSun = new Vector3((float)x, (float)y, (float)z);
            transform.rotation = Quaternion.LookRotation(-toSun, Vector3.up);

            float cloud = (float)w.Weather.CloudCover;
            float day = Mathf.Clamp01((float)(el + 4.0) / 10.0f);  // fade through civil twilight
            sun.intensity = clearNoonLux * day * Mathf.Lerp(1f, 0.25f, cloud);
            sun.enabled = day > 0f;
            if (colourByElevation != null) sun.color = colourByElevation.Evaluate(Mathf.Clamp01((float)el / 60f));
            if (moon != null)
            {
                moon.enabled = day <= 0.01f;
                moon.intensity = moonLux;
                moon.transform.rotation = Quaternion.LookRotation(toSun, Vector3.up);  // opposite the sun is good enough
            }
        }
    }
}
