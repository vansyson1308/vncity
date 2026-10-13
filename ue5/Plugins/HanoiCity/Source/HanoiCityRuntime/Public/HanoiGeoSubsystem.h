#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "HanoiCoreTypes.h"
#include "HanoiGeoSubsystem.generated.h"

/**
 * Transverse Mercator on WGS84 (k0 = 1), the same projection as the pipeline's
 * "+proj=tmerc +lat_0 +lon_0 +k=1 +x_0=0 +y_0=0 +ellps=WGS84".
 *
 * Krueger series in the third flattening n (Karney 2011), truncated after n^3. The first
 * dropped term is O(n^4 * a) ~ 5e-5 m, and the series converges far beyond city extent, so the
 * result matches PROJ to well under a millimetre for the whole of Hanoi (tests compare the
 * Python twin, Content/Python/hanoi_geo.py, against pyproj). Doubles throughout.
 */
struct HANOICITYRUNTIME_API FHanoiTransverseMercator
{
	FHanoiTransverseMercator(double InLat0Deg = 21.031, double InLon0Deg = 105.85);

	/** WGS84 degrees -> local metres (x = east, y = north). */
	void Forward(double LatDeg, double LonDeg, double& OutX, double& OutY) const;
	/** Local metres -> WGS84 degrees. */
	void Inverse(double X, double Y, double& OutLatDeg, double& OutLonDeg) const;

	double Lat0Deg;
	double Lon0Deg;

private:
	double ProjectedNorthing(double LatRad, double DLonRad, double* OutEasting) const;
	double N, A, Alpha[3], Beta[3], Delta[3], Y0;
};

/**
 * City georeference for the current world. Frames:
 *  - Geo: WGS84 lat/lon degrees + AltM (metres above the city origin height).
 *  - ENU: pipeline metres, x east, y north, z up (docs/pipeline-outputs.md).
 *  - World: UE centimetres, X = east, Y = south, Z = up (UE.X = 100x, UE.Y = -100y, UE.Z = 100z).
 * Yaw: pipeline degrees CCW from east -> UE yaw = -yaw.
 */
UCLASS()
class HANOICITYRUNTIME_API UHanoiGeoSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Geo")
	void SetOrigin(double Lat, double Lon, double HeightM);

	UFUNCTION(BlueprintPure, Category = "Hanoi|Geo")
	void GetOrigin(double& Lat, double& Lon, double& HeightM) const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Geo")
	FVector GeoToEnu(double Lat, double Lon, double AltM) const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Geo")
	void EnuToGeo(const FVector& Enu, double& Lat, double& Lon, double& AltM) const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Geo")
	FVector GeoToWorld(const FHanoiGeo& Geo) const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Geo")
	FHanoiGeo WorldToGeo(const FVector& World) const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Geo")
	static FVector EnuToWorld(const FVector& EnuMetres) { return FVector(EnuMetres.X * 100.0, -EnuMetres.Y * 100.0, EnuMetres.Z * 100.0); }

	UFUNCTION(BlueprintPure, Category = "Hanoi|Geo")
	static FVector WorldToEnu(const FVector& World) { return FVector(World.X / 100.0, -World.Y / 100.0, World.Z / 100.0); }

	/** Pipeline yaw (deg CCW from east) -> UE yaw (deg, clockwise seen from above). */
	UFUNCTION(BlueprintPure, Category = "Hanoi|Geo")
	static float EnuYawToWorldYaw(float YawDeg) { return -YawDeg; }

	const FHanoiTransverseMercator& GetProjection() const { return Projection; }

private:
	FHanoiTransverseMercator Projection;
	double OriginHeightM = 0.0;
};
