using HanoiCity.Geo;
using UnityEngine;

namespace HanoiCity.UnityLayer
{
    /// <summary>
    /// Tells the engine-free runtime where the player is (IHanoiPlayerQuery). Put it on the player
    /// pawn; vehicle and road state are set by the vehicle controller and the road probe (or by hand
    /// while prototyping).
    /// </summary>
    public sealed class HanoiPlayerAdapter : MonoBehaviour, IHanoiPlayerQuery
    {
        [Tooltip("On a motorbike, bicycle or car (random events with on_vehicle, fines).")]
        public bool onVehicle;
        [Tooltip("Driving a car: picks the car fine instead of the motorbike fine.")]
        public bool inCar;
        [Tooltip("Riding a bicycle (flood passable depth xe_dap) rather than a motorbike.")]
        public bool onBicycle;
        [Tooltip("ngo, pho, duong_lon, de, cau, via_he, cho, ben_xe, or empty.")]
        public string roadType = "";

        public bool HasPawn => this != null && isActiveAndEnabled;

        public Double3 PositionEnu
        {
            get
            {
                var p = transform.position;
                return HanoiFloatingOrigin.CurrentFrame.UnityToEnu(new Double3(p.x, p.y, p.z));
            }
        }

        public bool OnVehicle => onVehicle;
        public bool InCar => inCar;
        public bool OnBicycle => onBicycle;
        public string RoadType => string.IsNullOrEmpty(roadType) ? null : roadType;

        /// <summary>Teleport to an ENU position (mission debug, loading a save).</summary>
        public void TeleportEnu(Double3 enu)
        {
            var u = HanoiFloatingOrigin.CurrentFrame.EnuToUnity(enu);
            var cc = GetComponent<CharacterController>();
            if (cc != null) cc.enabled = false;
            transform.position = new Vector3((float)u.X, (float)u.Y, (float)u.Z);
            if (cc != null) cc.enabled = true;
        }
    }
}
