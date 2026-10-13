#include "HanoiTimeWeatherSubsystem.h"
#include "HanoiCitySettings.h"
#include "Components/LightComponent.h"
#include "Components/SceneComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "EngineUtils.h"

namespace HanoiTime
{
	const FTimespan UtcOffset = FTimespan::FromHours(7.0);
}

void UHanoiTimeWeatherSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	const UHanoiCitySettings* S = UHanoiCitySettings::Get();
	TimeScale = S->TimeScale;
	bRealTime = S->bSyncToRealHanoiTime;
	const FDateTime NowLocal = FDateTime::UtcNow() + HanoiTime::UtcOffset;
	GameTime = bRealTime ? NowLocal
		: FDateTime(NowLocal.GetYear(), NowLocal.GetMonth(), NowLocal.GetDay()) + FTimespan::FromHours(S->StartHour);

	switch (S->WeatherSource)
	{
	case EHanoiWeatherSourceKind::LiveHttp:
	{
		UHanoiHttpWeather* Http = NewObject<UHanoiHttpWeather>(this);
		Http->Endpoint = S->WeatherEndpoint;
		SetWeatherProvider(Http);
		break;
	}
	case EHanoiWeatherSourceKind::Climatology:
		SetWeatherProvider(NewObject<UHanoiClimatologyWeather>(this));
		break;
	default:
		break;
	}
	bReady = true;
	RefreshWeather();
}

void UHanoiTimeWeatherSubsystem::Deinitialize()
{
	bReady = false;
	Super::Deinitialize();
}

TStatId UHanoiTimeWeatherSubsystem::GetStatId() const
{
	RETURN_QUICK_DECLARE_CYCLE_STAT(UHanoiTimeWeatherSubsystem, STATGROUP_Tickables);
}

void UHanoiTimeWeatherSubsystem::SetWeatherProvider(TScriptInterface<IHanoiWeatherProvider> Provider)
{
	WeatherProvider = Provider;
	WeatherProviderObject = Provider.GetObject();
}

float UHanoiTimeWeatherSubsystem::GetHourOfDay() const
{
	return GameTime.GetHour() + GameTime.GetMinute() / 60.f + GameTime.GetSecond() / 3600.f;
}

void UHanoiTimeWeatherSubsystem::SetHanoiTime(FDateTime LocalTime)
{
	GameTime = LocalTime;
	UpdateSun();
	RefreshWeather();
}

void UHanoiTimeWeatherSubsystem::SetWeather(const FHanoiWeatherState& NewWeather)
{
	Weather = NewWeather;
	OnWeatherChanged.Broadcast(Weather);
}

void UHanoiTimeWeatherSubsystem::RefreshWeather()
{
	SecondsSincePoll = 0.f;
	if (IHanoiWeatherProvider* Provider = WeatherProvider.GetInterface())
	{
		TWeakObjectPtr<UHanoiTimeWeatherSubsystem> WeakThis(this);
		Provider->RequestWeather(GameTime, [WeakThis](const FHanoiWeatherState& State)
		{
			if (UHanoiTimeWeatherSubsystem* Self = WeakThis.Get())
			{
				Self->SetWeather(State);
			}
		});
	}
}

void UHanoiTimeWeatherSubsystem::Tick(float DeltaTime)
{
	if (bRealTime)
	{
		GameTime = FDateTime::UtcNow() + HanoiTime::UtcOffset;
	}
	else
	{
		GameTime += FTimespan::FromSeconds(double(DeltaTime) * TimeScale);
	}

	const int32 Hour = GameTime.GetHour();
	const bool bNewHour = Hour != LastHour;
	if (bNewHour)
	{
		LastHour = Hour;
		OnHourChanged.Broadcast(Hour);
	}

	// Live feeds poll on real time; climatology changes with game hours.
	SecondsSincePoll += DeltaTime;
	const bool bLive = UHanoiCitySettings::Get()->WeatherSource == EHanoiWeatherSourceKind::LiveHttp;
	if ((bLive && SecondsSincePoll >= UHanoiCitySettings::Get()->WeatherPollSeconds) || (!bLive && bNewHour))
	{
		RefreshWeather();
	}
	UpdateSun();
}

ADirectionalLight* UHanoiTimeWeatherSubsystem::FindSun()
{
	if (Sun.IsValid())
	{
		return Sun.Get();
	}
	UWorld* World = GetGameInstance() ? GetGameInstance()->GetWorld() : nullptr;
	if (!World)
	{
		return nullptr;
	}
	const FName Tag = UHanoiCitySettings::Get()->SunLightTag;
	ADirectionalLight* Found = nullptr;
	for (TActorIterator<ADirectionalLight> It(World); It; ++It)
	{
		if (It->ActorHasTag(Tag))
		{
			Found = *It;
			break;
		}
		Found = Found ? Found : *It;
	}
	// A Static light cannot be rotated at runtime (SetActorRotation would only log a warning).
	USceneComponent* Root = Found ? Found->GetRootComponent() : nullptr;
	if (Root && Root->Mobility == EComponentMobility::Static)
	{
		Root->SetMobility(EComponentMobility::Movable);
	}
	Sun = Found;
	return Found;
}

void UHanoiTimeWeatherSubsystem::UpdateSun()
{
	if (!UHanoiCitySettings::Get()->bDriveSun)
	{
		return;
	}
	if (ADirectionalLight* Light = FindSun())
	{
		float Elevation = 0.f, Azimuth = 0.f;
		GetSunPosition(Elevation, Azimuth);
		Light->SetActorRotation(SunRotation(Elevation, Azimuth));
	}
}

void UHanoiTimeWeatherSubsystem::GetSunPosition(float& ElevationDeg, float& AzimuthDeg) const
{
	const UHanoiCitySettings* S = UHanoiCitySettings::Get();
	double El = 0.0, Az = 0.0;
	ComputeSunPosition(GameTime - HanoiTime::UtcOffset, S->OriginLat, S->OriginLon, El, Az);
	ElevationDeg = float(El);
	AzimuthDeg = float(Az);
}

FRotator UHanoiTimeWeatherSubsystem::SunRotation(float ElevationDeg, float AzimuthDeg)
{
	const double El = FMath::DegreesToRadians(double(ElevationDeg));
	const double Az = FMath::DegreesToRadians(double(AzimuthDeg));
	// Direction towards the sun in ENU (x east, y north, z up), then into UE (Y = -north).
	const FVector ToSun(FMath::Sin(Az) * FMath::Cos(El), -FMath::Cos(Az) * FMath::Cos(El), FMath::Sin(El));
	// A directional light shines along its forward (X) axis, i.e. away from the sun.
	return FRotationMatrix::MakeFromX(-ToSun).Rotator();
}

void UHanoiTimeWeatherSubsystem::ComputeSunPosition(const FDateTime& Utc, double LatDeg, double LonDeg, double& OutElevationDeg, double& OutAzimuthDeg)
{
	const double JD = Utc.GetJulianDay();
	const double JC = (JD - 2451545.0) / 36525.0;
	const double L0 = FMath::Fmod(280.46646 + JC * (36000.76983 + JC * 0.0003032), 360.0);
	const double M = 357.52911 + JC * (35999.05029 - 0.0001537 * JC);
	const double E = 0.016708634 - JC * (0.000042037 + 0.0000001267 * JC);
	const double Mr = FMath::DegreesToRadians(M);
	const double C = FMath::Sin(Mr) * (1.914602 - JC * (0.004817 + 0.000014 * JC))
		+ FMath::Sin(2.0 * Mr) * (0.019993 - 0.000101 * JC) + FMath::Sin(3.0 * Mr) * 0.000289;
	const double Omega = FMath::DegreesToRadians(125.04 - 1934.136 * JC);
	const double AppLong = L0 + C - 0.00569 - 0.00478 * FMath::Sin(Omega);
	const double Obliq = 23.0 + (26.0 + (21.448 - JC * (46.815 + JC * (0.00059 - JC * 0.001813))) / 60.0) / 60.0;
	const double ObliqCorr = FMath::DegreesToRadians(Obliq + 0.00256 * FMath::Cos(Omega));
	const double Decl = FMath::Asin(FMath::Sin(ObliqCorr) * FMath::Sin(FMath::DegreesToRadians(AppLong)));
	const double Y = FMath::Square(FMath::Tan(ObliqCorr / 2.0));
	const double L0r = FMath::DegreesToRadians(L0);
	const double EqTime = 4.0 * FMath::RadiansToDegrees(Y * FMath::Sin(2.0 * L0r) - 2.0 * E * FMath::Sin(Mr)
		+ 4.0 * E * Y * FMath::Sin(Mr) * FMath::Cos(2.0 * L0r) - 0.5 * Y * Y * FMath::Sin(4.0 * L0r)
		- 1.25 * E * E * FMath::Sin(2.0 * Mr));
	const double MinutesUtc = Utc.GetHour() * 60.0 + Utc.GetMinute() + Utc.GetSecond() / 60.0;
	double Tst = FMath::Fmod(MinutesUtc + EqTime + 4.0 * LonDeg, 1440.0);
	if (Tst < 0.0)
	{
		Tst += 1440.0;
	}
	const double Ha = Tst / 4.0 - 180.0;
	const double Lat = FMath::DegreesToRadians(LatDeg);
	const double Har = FMath::DegreesToRadians(Ha);
	const double CosZen = FMath::Clamp(FMath::Sin(Lat) * FMath::Sin(Decl) + FMath::Cos(Lat) * FMath::Cos(Decl) * FMath::Cos(Har), -1.0, 1.0);
	const double Zen = FMath::Acos(CosZen);
	const double Denom = FMath::Cos(Lat) * FMath::Sin(Zen);
	double Az = 180.0;
	if (FMath::Abs(Denom) > 1e-9)
	{
		const double X = FMath::Clamp((FMath::Sin(Lat) * FMath::Cos(Zen) - FMath::Sin(Decl)) / Denom, -1.0, 1.0);
		const double A = FMath::RadiansToDegrees(FMath::Acos(X));
		Az = Ha > 0.0 ? FMath::Fmod(A + 180.0, 360.0) : FMath::Fmod(540.0 - A, 360.0);
	}
	OutElevationDeg = 90.0 - FMath::RadiansToDegrees(Zen);
	OutAzimuthDeg = Az;
}
