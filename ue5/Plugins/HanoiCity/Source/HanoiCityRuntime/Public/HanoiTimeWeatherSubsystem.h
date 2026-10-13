#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Tickable.h"
#include "HanoiWeather.h"
#include "HanoiTimeWeatherSubsystem.generated.h"

class ADirectionalLight;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHanoiWeatherChangedSignature, const FHanoiWeatherState&, Weather);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHanoiHourChangedSignature, int32, Hour);

/**
 * Game clock in Hanoi local time (UTC+7, no DST), weather state, and the sun.
 * Clock: scaled by Settings.TimeScale, or locked to the real Hanoi clock (bSyncToRealHanoiTime).
 * Weather: an IHanoiWeatherProvider (climatology, the live HTTP feed, or Manual via SetWeather).
 * Sun: NOAA solar position at the city origin -> directional light rotation.
 */
UCLASS()
class HANOICITYRUNTIME_API UHanoiTimeWeatherSubsystem : public UGameInstanceSubsystem, public FTickableGameObject
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	// FTickableGameObject
	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override;
	virtual bool IsTickable() const override { return bReady; }
	virtual ETickableTickType GetTickableTickType() const override { return ETickableTickType::Conditional; }

	UFUNCTION(BlueprintPure, Category = "Hanoi|Time")
	FDateTime GetHanoiTime() const { return GameTime; }

	/** Fractional hour of day 0-24, Hanoi local. */
	UFUNCTION(BlueprintPure, Category = "Hanoi|Time")
	float GetHourOfDay() const;

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Time")
	void SetHanoiTime(FDateTime LocalTime);

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Time")
	void SetTimeScale(float NewScale) { TimeScale = FMath::Max(0.f, NewScale); }

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Time")
	void SetSyncToRealTime(bool bSync) { bRealTime = bSync; }

	UFUNCTION(BlueprintPure, Category = "Hanoi|Weather")
	const FHanoiWeatherState& GetWeather() const { return Weather; }

	/** Overrides the weather now (and keeps it if the source is Manual). */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Weather")
	void SetWeather(const FHanoiWeatherState& NewWeather);

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Weather")
	void RefreshWeather();

	/** Replace the weather feed (e.g. a custom adapter). */
	void SetWeatherProvider(TScriptInterface<IHanoiWeatherProvider> Provider);

	/** Sun elevation/azimuth in degrees (azimuth clockwise from north) for the current game time. */
	UFUNCTION(BlueprintPure, Category = "Hanoi|Time")
	void GetSunPosition(float& ElevationDeg, float& AzimuthDeg) const;

	/** NOAA solar position. Twin of hanoi_geo.solar_position (tested there). */
	static void ComputeSunPosition(const FDateTime& Utc, double LatDeg, double LonDeg, double& OutElevationDeg, double& OutAzimuthDeg);

	/** UE rotation for a directional light shining from (elevation, azimuth); X = east, Y = south. */
	UFUNCTION(BlueprintPure, Category = "Hanoi|Time")
	static FRotator SunRotation(float ElevationDeg, float AzimuthDeg);

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Weather")
	FHanoiWeatherChangedSignature OnWeatherChanged;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Time")
	FHanoiHourChangedSignature OnHourChanged;

private:
	void UpdateSun();
	ADirectionalLight* FindSun();

	FDateTime GameTime;
	FHanoiWeatherState Weather;
	float TimeScale = 30.f;
	bool bRealTime = false;
	bool bReady = false;
	float SecondsSincePoll = 0.f;
	int32 LastHour = -1;

	UPROPERTY()
	TScriptInterface<IHanoiWeatherProvider> WeatherProvider;

	UPROPERTY()
	TObjectPtr<UObject> WeatherProviderObject;

	TWeakObjectPtr<ADirectionalLight> Sun;
};
