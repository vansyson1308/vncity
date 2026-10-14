using System;
using System.Collections.Generic;
using HanoiCity.Geo;
using UnityEngine;

namespace HanoiCity.UnityLayer
{
    /// <summary>
    /// Floating origin for a 24 x 21 km city: float32 positions lose millimetres beyond ~8 km and
    /// physics jitters beyond ~14 km. When the tracked transform (the player) is farther than
    /// the threshold from the Unity origin, the frame's RebaseEnu moves to it (rounded to 100 m),
    /// every HanoiGeoAnchor re-places itself from its double ENU, and unanchored root objects are
    /// shifted by the same delta. Game logic never sees the shift: it uses ENU doubles
    /// (HanoiWorld.Geo / IHanoiPlayerQuery.PositionEnu). HDRP camera-relative rendering handles the
    /// rendering side; this handles physics, animation and particles.
    /// </summary>
    public sealed class HanoiFloatingOrigin : MonoBehaviour
    {
        static readonly HashSet<HanoiGeoAnchor> anchors = new HashSet<HanoiGeoAnchor>();
        static HanoiGeoFrame editorFrame;

        /// <summary>The live frame (HanoiGame's world) or, in edit mode, an un-rebased default frame.</summary>
        public static HanoiGeoFrame CurrentFrame => HanoiGame.Instance != null && HanoiGame.Instance.World != null
            ? HanoiGame.Instance.World.Geo : EditorFrame;

        public static HanoiGeoFrame EditorFrame => editorFrame ??= new HanoiGeoFrame();

        /// <summary>Fired after a shift with the Unity-space delta that was subtracted from everything.</summary>
        public static event Action<Vector3> Shifted;

        public Transform tracked;
        public float thresholdM = 2000f;
        [Tooltip("Root objects without a HanoiGeoAnchor that must follow the shift (player rig, traffic, VFX).")]
        public List<Transform> unanchoredRoots = new List<Transform>();

        internal static void Register(HanoiGeoAnchor a) => anchors.Add(a);
        internal static void Unregister(HanoiGeoAnchor a) => anchors.Remove(a);

        void LateUpdate()
        {
            if (tracked == null || HanoiGame.Instance == null || HanoiGame.Instance.World == null) return;
            var p = tracked.position;
            if (new Vector2(p.x, p.z).magnitude < thresholdM) return;
            Shift(HanoiGame.Instance.World.Geo, p);
        }

        public void Shift(HanoiGeoFrame frame, Vector3 aroundUnity)
        {
            var enu = frame.UnityToEnu(new Double3(aroundUnity.x, aroundUnity.y, aroundUnity.z));
            var old = frame.RebaseEnu;
            var next = new Double3(Math.Round(enu.X / 100.0) * 100.0, Math.Round(enu.Y / 100.0) * 100.0, 0);
            frame.RebaseEnu = next;
            var delta = new Vector3((float)(next.X - old.X), 0f, (float)(next.Y - old.Y));
            foreach (var a in anchors) a.Apply(frame);
            foreach (var t in unanchoredRoots) if (t != null) t.position -= delta;
            if (tracked != null && !unanchoredRoots.Contains(tracked)) tracked.position -= delta;
            Physics.SyncTransforms();
            Shifted?.Invoke(delta);
        }
    }
}
