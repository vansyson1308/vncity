#include "HanoiGeoSubsystem.h"
#include "HanoiCitySettings.h"

#include <cmath>

namespace HanoiGeo
{
	// WGS84
	constexpr double SemiMajor = 6378137.0;
	constexpr double Flattening = 1.0 / 298.257223563;
}

FHanoiTransverseMercator::FHanoiTransverseMercator(double InLat0Deg, double InLon0Deg)
	: Lat0Deg(InLat0Deg), Lon0Deg(InLon0Deg)
{
	N = HanoiGeo::Flattening / (2.0 - HanoiGeo::Flattening);
	const double N2 = N * N, N3 = N2 * N;
	A = HanoiGeo::SemiMajor / (1.0 + N) * (1.0 + N2 / 4.0 + N2 * N2 / 64.0);
	Alpha[0] = N / 2.0 - 2.0 / 3.0 * N2 + 5.0 / 16.0 * N3;
	Alpha[1] = 13.0 / 48.0 * N2 - 3.0 / 5.0 * N3;
	Alpha[2] = 61.0 / 240.0 * N3;
	Beta[0] = N / 2.0 - 2.0 / 3.0 * N2 + 37.0 / 96.0 * N3;
	Beta[1] = 1.0 / 48.0 * N2 + 1.0 / 15.0 * N3;
	Beta[2] = 17.0 / 480.0 * N3;
	Delta[0] = 2.0 * N - 2.0 / 3.0 * N2 - 2.0 * N3;
	Delta[1] = 7.0 / 3.0 * N2 - 8.0 / 5.0 * N3;
	Delta[2] = 56.0 / 15.0 * N3;
	Y0 = 0.0;
	Y0 = ProjectedNorthing(FMath::DegreesToRadians(Lat0Deg), 0.0, nullptr);
}

double FHanoiTransverseMercator::ProjectedNorthing(double Phi, double Lambda, double* OutEasting) const
{
	const double K = 2.0 * FMath::Sqrt(N) / (1.0 + N);
	const double SinPhi = FMath::Sin(Phi);
	const double T = std::sinh(std::atanh(SinPhi) - K * std::atanh(K * SinPhi));
	const double XiP = FMath::Atan2(T, FMath::Cos(Lambda));
	const double EtaP = std::atanh(FMath::Sin(Lambda) / FMath::Sqrt(1.0 + T * T));
	double Xi = XiP, Eta = EtaP;
	for (int32 J = 1; J <= 3; ++J)
	{
		Xi += Alpha[J - 1] * FMath::Sin(2.0 * J * XiP) * std::cosh(2.0 * J * EtaP);
		Eta += Alpha[J - 1] * FMath::Cos(2.0 * J * XiP) * std::sinh(2.0 * J * EtaP);
	}
	if (OutEasting)
	{
		*OutEasting = A * Eta;
	}
	return A * Xi - Y0;
}

void FHanoiTransverseMercator::Forward(double LatDeg, double LonDeg, double& OutX, double& OutY) const
{
	OutY = ProjectedNorthing(FMath::DegreesToRadians(LatDeg), FMath::DegreesToRadians(LonDeg - Lon0Deg), &OutX);
}

void FHanoiTransverseMercator::Inverse(double X, double Y, double& OutLatDeg, double& OutLonDeg) const
{
	const double Xi = (Y + Y0) / A;
	const double Eta = X / A;
	double XiP = Xi, EtaP = Eta;
	for (int32 J = 1; J <= 3; ++J)
	{
		XiP -= Beta[J - 1] * FMath::Sin(2.0 * J * Xi) * std::cosh(2.0 * J * Eta);
		EtaP -= Beta[J - 1] * FMath::Cos(2.0 * J * Xi) * std::sinh(2.0 * J * Eta);
	}
	const double Chi = FMath::Asin(FMath::Sin(XiP) / std::cosh(EtaP));
	double Phi = Chi;
	for (int32 J = 1; J <= 3; ++J)
	{
		Phi += Delta[J - 1] * FMath::Sin(2.0 * J * Chi);
	}
	OutLatDeg = FMath::RadiansToDegrees(Phi);
	OutLonDeg = Lon0Deg + FMath::RadiansToDegrees(FMath::Atan2(std::sinh(EtaP), FMath::Cos(XiP)));
}

void UHanoiGeoSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	const UHanoiCitySettings* S = UHanoiCitySettings::Get();
	SetOrigin(S->OriginLat, S->OriginLon, S->OriginHeightM);
}

void UHanoiGeoSubsystem::SetOrigin(double Lat, double Lon, double HeightM)
{
	Projection = FHanoiTransverseMercator(Lat, Lon);
	OriginHeightM = HeightM;
}

void UHanoiGeoSubsystem::GetOrigin(double& Lat, double& Lon, double& HeightM) const
{
	Lat = Projection.Lat0Deg;
	Lon = Projection.Lon0Deg;
	HeightM = OriginHeightM;
}

FVector UHanoiGeoSubsystem::GeoToEnu(double Lat, double Lon, double AltM) const
{
	double X = 0.0, Y = 0.0;
	Projection.Forward(Lat, Lon, X, Y);
	return FVector(X, Y, AltM);
}

void UHanoiGeoSubsystem::EnuToGeo(const FVector& Enu, double& Lat, double& Lon, double& AltM) const
{
	Projection.Inverse(Enu.X, Enu.Y, Lat, Lon);
	AltM = Enu.Z;
}

FVector UHanoiGeoSubsystem::GeoToWorld(const FHanoiGeo& Geo) const
{
	return EnuToWorld(GeoToEnu(Geo.Lat, Geo.Lon, Geo.AltM));
}

FHanoiGeo UHanoiGeoSubsystem::WorldToGeo(const FVector& World) const
{
	FHanoiGeo Out;
	EnuToGeo(WorldToEnu(World), Out.Lat, Out.Lon, Out.AltM);
	Out.bIsSet = true;
	return Out;
}
