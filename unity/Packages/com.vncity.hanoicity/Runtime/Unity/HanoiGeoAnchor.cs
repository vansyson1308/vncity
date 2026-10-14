using HanoiCity.Geo;
using UnityEngine;

namespace HanoiCity.UnityLayer
{
    /// <summary>
    /// Keeps a static object at a fixed ENU position (double precision) across floating-origin shifts.
    /// The importer puts one on every tile root, point-set batch and verify marker. Objects without an
    /// anchor (the player, vehicles, props spawned at runtime) are moved by HanoiFloatingOrigin by the
    /// shift delta instead.
    /// </summary>
    [ExecuteAlways, DisallowMultipleComponent]
    public sealed class HanoiGeoAnchor : MonoBehaviour
    {
        [Tooltip("Metres east of the Hanoi origin (hồ Gươm).")] public double east;
        [Tooltip("Metres north of the Hanoi origin.")] public double north;
        [Tooltip("Metres above the origin height.")] public double up;

        public Double3 Enu
        {
            get => new Double3(east, north, up);
            set { east = value.X; north = value.Y; up = value.Z; }
        }

        void OnEnable()
        {
            HanoiFloatingOrigin.Register(this);
            Apply(HanoiFloatingOrigin.CurrentFrame);
        }

        void OnDisable() => HanoiFloatingOrigin.Unregister(this);

        public void Apply(HanoiGeoFrame frame)
        {
            if (frame == null) frame = HanoiFloatingOrigin.EditorFrame;
            var u = frame.EnuToUnity(Enu);
            transform.position = new Vector3((float)u.X, (float)u.Y, (float)u.Z);
        }
    }
}
